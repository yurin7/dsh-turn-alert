/**
 * Turn alert: raise a desktop-attention signal when a turn ends.
 *
 * The Host process is a Node-mode child of the DSH Desktop shell and holds no
 * Electron window handle, so it locates the shell window through its own
 * parent-process chain and drives it with plain Win32 calls, and it raises the
 * toast through the shell's registered AppUserModelID. Both effects are best
 * effort: a failure in either one is logged and never disturbs the turn.
 *
 * The row exposes a real Config schema, which is what makes these switches
 * editable from the Plugins page: the Host serves a settings namespace per
 * plugin entry whose Config has a volatile form.
 *
 * @module dsh-turn-alert
 */

import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

/**
 * Bundles linked from a working directory resolve packages from that
 * directory, which has no `node_modules`, so peer packages are resolved through
 * explicit anchors instead of static imports.
 */
const requireModule = createRequire(import.meta.url)

/**
 * Load a package from wherever this installation keeps it.
 *
 * The bundle declares no hard dependency on `koffi` (a native addon that only
 * the Desktop build ships) or `schemastery` (a peer the Host provides), so both
 * are resolved through explicit anchors instead of static imports. An anchor
 * list rather than a single path keeps the plugin working whether it is linked
 * from a checkout, installed into a profile, or run from the packaged Desktop.
 *
 * @param specifier - package name to resolve.
 * @returns the module, or undefined when no anchor answers.
 */
function loadPackage(specifier) {
  const anchors = [import.meta.url]
  if (process.env.DSH_PROFILE_DIR) anchors.push(join(process.env.DSH_PROFILE_DIR, 'anchor.js'))
  if (process.env.DSH_INSTALL_DIR) anchors.push(join(process.env.DSH_INSTALL_DIR, 'anchor.js'))
  if (typeof process.resourcesPath === 'string') {
    // Packaged Desktop: the dsh payload sits inside app.asar, its native addons
    // beside it in app.asar.unpacked.
    anchors.push(join(process.resourcesPath, 'app.asar', 'dsh', 'anchor.js'))
    anchors.push(join(process.resourcesPath, 'app.asar.unpacked', 'dsh', 'anchor.js'))
  }
  for (const anchor of anchors) {
    try {
      return createRequire(anchor)(specifier)
    } catch {
      // Try the next anchor.
    }
  }
  return undefined
}

/** Reasons that end a turn. */
const ALERTABLE_REASONS = new Set(['completed', 'error', 'max-tokens'])

/** Windows AppUserModelID the Desktop shell registers for its Start Menu shortcut. */
const DEFAULT_APP_USER_MODEL_ID = 'com.deepseek.dsh'

/**
 * Toast copy per language.
 *
 * `completed` is a normal finish; `problem` covers a failed or truncated turn.
 * The Host cannot read the browser's active locale directly, so the language is
 * resolved in {@link resolveLanguage} from the stored preference and then the
 * runtime locale.
 */
const MESSAGES = {
  en: {
    title: 'DSH finished replying',
    body: 'Turn completed.',
    problemTitle: 'DSH turn ended with a problem',
    problemBody: 'Open DeepSeek Harness to review the turn.',
  },
  zh: {
    title: 'DSH 回答完成',
    body: '本轮对话已完成。',
    problemTitle: 'DSH 这一轮出错结束',
    problemBody: '打开 DeepSeek Harness 查看这一轮。',
  },
  ja: {
    title: 'DSH の応答が完了しました',
    body: 'このターンは完了しました。',
    problemTitle: 'DSH のターンが問題で終了しました',
    problemBody: 'DeepSeek Harness を開いて確認してください。',
  },
  ko: {
    title: 'DSH 응답이 완료되었습니다',
    body: '이번 턴이 완료되었습니다.',
    problemTitle: 'DSH 턴이 문제로 종료되었습니다',
    problemBody: 'DeepSeek Harness를 열어 확인하세요.',
  },
  es: {
    title: 'DSH terminó de responder',
    body: 'Turno completado.',
    problemTitle: 'El turno de DSH terminó con un problema',
    problemBody: 'Abre DeepSeek Harness para revisar el turno.',
  },
  fr: {
    title: 'DSH a fini de répondre',
    body: 'Tour terminé.',
    problemTitle: 'Le tour DSH s’est terminé avec un problème',
    problemBody: 'Ouvrez DeepSeek Harness pour examiner le tour.',
  },
  de: {
    title: 'DSH hat die Antwort abgeschlossen',
    body: 'Turn abgeschlossen.',
    problemTitle: 'DSH-Turn mit einem Problem beendet',
    problemBody: 'Öffne DeepSeek Harness, um den Turn zu prüfen.',
  },
  ru: {
    title: 'DSH завершил ответ',
    body: 'Ход завершён.',
    problemTitle: 'Ход DSH завершился с ошибкой',
    problemBody: 'Откройте DeepSeek Harness, чтобы посмотреть ход.',
  },
  pt: {
    title: 'DSH terminou de responder',
    body: 'Turno concluído.',
    problemTitle: 'O turno do DSH terminou com um problema',
    problemBody: 'Abra o DeepSeek Harness para revisar o turno.',
  },
}

/** Language used when nothing else resolves. */
const FALLBACK_LANGUAGE = 'en'

/**
 * Reduce a BCP 47 tag to a supported language id.
 * @param tag - a tag such as `zh-CN`, `pt-BR`, or `en`.
 * @returns a key of {@link MESSAGES}, or undefined when unsupported.
 */
function matchLanguage(tag) {
  if (typeof tag !== 'string' || tag.length === 0) return undefined
  const primary = tag.toLowerCase().split(/[-_]/u)[0]
  return Object.hasOwn(MESSAGES, primary) ? primary : undefined
}

/**
 * Resolve the language for alert copy.
 *
 * Order: the explicit `language` option, then the locale the GUI persisted, then
 * the runtime locale, then English. The GUI preference lives in the `locale`
 * settings namespace as `preference`; it is absent while the user has never
 * chosen a language, which is when the runtime locale takes over.
 *
 * @param ctx - Host context, used only to read the settings service.
 * @param explicit - the row's `language` option, `auto` to detect.
 * @returns a key of {@link MESSAGES}.
 */
function resolveLanguage(ctx, explicit) {
  if (explicit !== 'auto' && Object.hasOwn(MESSAGES, explicit)) return explicit

  // The GUI's own selection wins: it is what the person sees on screen.
  try {
    const settings = ctx.get?.('settings')
    const described = settings?.describe?.()
    if (Array.isArray(described)) {
      const row = described.find((entry) => entry?.ns === 'locale')
      const preferred = row?.value?.preference
      const matched = matchLanguage(preferred)
      if (matched !== undefined) return matched
    }
  } catch {
    // A missing or failing settings service only costs the preference.
  }

  // No explicit selection: follow the runtime, which mirrors the OS.
  try {
    const runtime = Intl.DateTimeFormat().resolvedOptions().locale
    const matched = matchLanguage(runtime)
    if (matched !== undefined) return matched
  } catch {
    // Intl is always present in Node, but never let it break an alert.
  }

  return FALLBACK_LANGUAGE
}

/**
 * FlashWindowEx flags.
 * `FLASHW_ALL` flashes the caption and the taskbar button together;
 * `FLASHW_TIMERNOFG` keeps flashing until the window reaches the foreground.
 */
const FLASHW_ALL = 0x00000003
const FLASHW_TIMERNOFG = 0x0000000c

/** Built-once Win32 bindings, or the failure that prevented them. */
let win32Binding

export const name = 'turn-alert'

/** Every option with its default; the row's `config` overrides any of them. */
export const DEFAULTS = Object.freeze({
  enabled: true,
  flashTaskbar: true,
  notify: true,
  // The user asked to be alerted even while the window is in front.
  skipWhenFocused: false,
  alertOnError: true,
  // Subagent turns are internal work, not a reply the user is waiting on.
  includeSubagents: false,
  cooldownSeconds: 3,
  appUserModelId: DEFAULT_APP_USER_MODEL_ID,
  // `auto` follows the GUI language, then the runtime locale.
  language: 'auto',
  // Use the session's own title as the headline when one exists.
  titleFromSession: true,
  // Extra text appended after the headline; empty keeps the built-in copy.
  customTitle: '',
  customBody: '',
  trace: false,
})

const Schema = loadPackage('@deepseek-ai/schemastery')

/**
 * Row Config: a serializable schema the settings form renders.
 *
 * Each field is `volatile()`, so an edit applies live: the Host updates the
 * running instance instead of restarting it, and the listener re-reads values
 * for every turn.
 */
export const Config = Schema === undefined
  ? undefined
  : Schema.object({
      enabled: Schema.boolean()
        .default(DEFAULTS.enabled)
        .description('Master switch for every alert.')
        .volatile(),
      flashTaskbar: Schema.boolean()
        .default(DEFAULTS.flashTaskbar)
        .description('Flash the taskbar button when a turn ends.')
        .volatile(),
      notify: Schema.boolean()
        .default(DEFAULTS.notify)
        .description('Raise a system notification when a turn ends.')
        .volatile(),
      skipWhenFocused: Schema.boolean()
        .default(DEFAULTS.skipWhenFocused)
        .description('Stay silent while the DeepSeek Harness window is in the foreground.')
        .volatile(),
      alertOnError: Schema.boolean()
        .default(DEFAULTS.alertOnError)
        .description('Also alert when a turn ends in failure.')
        .volatile(),
      includeSubagents: Schema.boolean()
        .default(DEFAULTS.includeSubagents)
        .description('Also alert when a subagent session finishes its own turn.')
        .volatile(),
      cooldownSeconds: Schema.number()
        .min(0)
        .default(DEFAULTS.cooldownSeconds)
        .description('Minimum seconds between two alerts.')
        .volatile(),
      appUserModelId: Schema.string()
        .default(DEFAULTS.appUserModelId)
        .description('AppUserModelID the notification is attributed to.')
        .volatile(),
      language: Schema.union(['auto', ...Object.keys(MESSAGES)])
        .default(DEFAULTS.language)
        .description('Language of the notification text; auto follows the interface language.')
        .volatile(),
      titleFromSession: Schema.boolean()
        .default(DEFAULTS.titleFromSession)
        .description('Use the conversation title as the notification headline.')
        .volatile(),
      customTitle: Schema.string()
        .default(DEFAULTS.customTitle)
        .description('Custom headline. Empty keeps the built-in or session title. Supports {title}, {reason}, {session}.')
        .volatile(),
      customBody: Schema.string()
        .default(DEFAULTS.customBody)
        .description('Custom body text. Empty keeps the built-in copy. Supports {title}, {reason}, {session}.')
        .volatile(),
      trace: Schema.boolean()
        .default(DEFAULTS.trace)
        .description('Write one diagnostic line per turn end, for troubleshooting.')
        .volatile(),
    })

/** Read a live field, accepting both a plain value and a `Volatile` reference. */
function live(value, fallback) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    const current = value.get()
    return current === undefined ? fallback : current
  }
  return value === undefined ? fallback : value
}

/**
 * Read the effective settings from the row config.
 * @param raw - the row's `config`, possibly holding `Volatile` references.
 */
function resolveConfig(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const pickBool = (key) => {
    const value = live(input[key], DEFAULTS[key])
    return typeof value === 'boolean' ? value : DEFAULTS[key]
  }
  const cooldown = Number(live(input.cooldownSeconds, DEFAULTS.cooldownSeconds))
  const aumid = live(input.appUserModelId, DEFAULTS.appUserModelId)
  const language = live(input.language, DEFAULTS.language)
  const customTitle = live(input.customTitle, DEFAULTS.customTitle)
  const customBody = live(input.customBody, DEFAULTS.customBody)
  const text = (value, fallback) => (typeof value === 'string' ? value : fallback)
  return {
    enabled: pickBool('enabled'),
    flashTaskbar: pickBool('flashTaskbar'),
    notify: pickBool('notify'),
    skipWhenFocused: pickBool('skipWhenFocused'),
    alertOnError: pickBool('alertOnError'),
    includeSubagents: pickBool('includeSubagents'),
    cooldownSeconds: Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : DEFAULTS.cooldownSeconds,
    appUserModelId: typeof aumid === 'string' && aumid.length > 0 ? aumid : DEFAULTS.appUserModelId,
    language: language === 'auto' || Object.hasOwn(MESSAGES, language) ? language : DEFAULTS.language,
    titleFromSession: pickBool('titleFromSession'),
    customTitle: text(customTitle, DEFAULTS.customTitle),
    customBody: text(customBody, DEFAULTS.customBody),
    trace: pickBool('trace'),
  }
}

/**
 * Append one diagnostic line, best effort.
 * @param line - what the plugin decided and why.
 */
function trace(line) {
  try {
    mkdirSync(tmpdir(), { recursive: true })
    appendFileSync(join(tmpdir(), 'dsh-turn-alert.log'), `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch {
    // Diagnostics must never break the alert path.
  }
}

/**
 * Read the conversation's current title.
 *
 * Titles are durable `session/title` events folded by the session-title
 * service, so `get()` is the supported reader; the raw event log is only a
 * fallback for a profile that mounts the store without that service.
 *
 * @param ctx - Host context used to reach the title service.
 * @param session - the session whose turn just ended.
 * @returns the title text, or undefined when the conversation has none yet.
 */
function readSessionTitle(ctx, session) {
  if (session === undefined || session === null) return undefined
  try {
    const service = ctx.get?.('sessionTitle')
    const snapshot = service?.get?.(session)
    const title = snapshot?.title
    if (typeof title === 'string' && title.trim() !== '') return title.trim()
  } catch {
    // Fall through to the log scan.
  }
  // A profile without the title service still logs `session/title` events, so
  // read the newest one directly. `snapshotEvents()` is the supported reader.
  try {
    const events = session.snapshotEvents?.() ?? []
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type !== 'session/title') continue
      const title = event.data?.title
      if (typeof title === 'string' && title.trim() !== '') return title.trim()
    }
  } catch {
    // No readable log: the alert simply keeps its built-in headline.
  }
  return undefined
}

/**
 * Fill `{name}` placeholders in a template.
 * @param template - text containing `{title}`, `{reason}`, or `{session}`.
 * @param values - replacement values.
 */
function fillTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/gu, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key] ?? '') : match,
  )
}

/**
 * Build the Win32 binding table once, on first use.
 * @returns the native helpers, or a record carrying the failure.
 */
function createWin32() {
  if (process.platform !== 'win32') return undefined
  // koffi registers type names process-wide, so the bindings are built once;
  // a second struct declaration with the same name throws.
  if (win32Binding !== undefined) return win32Binding
  const koffi = loadPackage('koffi')
  if (koffi === undefined) {
    // A plain `dsh web` install ships no native addon. The toast still works, so
    // this is a degraded mode rather than a failure: the plugin says so once.
    win32Binding = {
      error: new Error('koffi is unavailable, so the taskbar cannot flash; the notification still works'),
    }
    return win32Binding
  }

  try {
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')

    // koffi registers type names process-wide, so a second declaration with the
    // same name throws. This plugin can be loaded twice in one process (two
    // profiles, or a reload), so every struct name gets a suffix that is free.
    // The chosen name is then used in the C prototypes below, which are strings
    // and must name the same type the struct was registered under.
    const freeName = (base) => {
      for (let n = 0; n < 32; n += 1) {
        const candidate = n === 0 ? base : `${base}_${n}`
        try {
          koffi.type(candidate)
          // Resolved, so the name is taken; try the next suffix.
        } catch {
          return candidate
        }
      }
      throw new Error(`turn-alert: no free native type name near ${base}`)
    }

    const PE32_NAME = freeName('TURN_ALERT_PE32')
    const PE32 = koffi.struct(PE32_NAME, {
      dwSize: 'uint32',
      cntUsage: 'uint32',
      th32ProcessID: 'uint32',
      th32DefaultHeapID: 'uintptr_t',
      th32ModuleID: 'uint32',
      cntThreads: 'uint32',
      th32ParentProcessID: 'uint32',
      pcPriClassBase: 'int32',
      dwFlags: 'uint32',
      szExeFile: koffi.array('char16_t', 260, 'Array'),
    })

    const FLASHWINFO_NAME = freeName('TURN_ALERT_FLASHWINFO')
    const FLASHWINFO = koffi.struct(FLASHWINFO_NAME, {
      cbSize: 'uint32',
      hwnd: 'intptr',
      dwFlags: 'uint32',
      uCount: 'uint32',
      dwTimeout: 'uint32',
    })

    const createsnapshot = kernel32.func('intptr __stdcall CreateToolhelp32Snapshot(uint32, uint32)')
    const process32First = kernel32.func(`bool __stdcall Process32FirstW(intptr, _Inout_ ${PE32_NAME} *)`)
    const process32Next = kernel32.func(`bool __stdcall Process32NextW(intptr, _Inout_ ${PE32_NAME} *)`)
    const closeHandle = kernel32.func('bool __stdcall CloseHandle(intptr)')

    const enumWindows = user32.func('bool __stdcall EnumWindows(void *, intptr)')
    const windowPid = user32.func('uint32 __stdcall GetWindowThreadProcessId(intptr, _Out_ uint32 *)')
    const isWindow = user32.func('bool __stdcall IsWindow(intptr)')
    const isVisible = user32.func('bool __stdcall IsWindowVisible(intptr)')
    const textLength = user32.func('int __stdcall GetWindowTextLengthW(intptr)')
    const foreground = user32.func('intptr __stdcall GetForegroundWindow()')
    const flashWindowEx = user32.func('bool __stdcall FlashWindowEx(_Inout_ TURN_ALERT_FLASHWINFO *)')
    const enumProc = koffi.proto('bool __stdcall TURN_ALERT_EWP(intptr, intptr)')

    /** Read a null-terminated UTF-16 process name. */
    const readExeName = (units) => {
      if (!units) return ''
      let text = ''
      for (const unit of units) {
        if (unit === 0) break
        text += String.fromCharCode(unit)
      }
      return text
    }

    /** Map pid to its parent pid and image name. */
    const processTable = () => {
      const table = new Map()
      const snapshot = createsnapshot(0x00000002, 0)
      if (!snapshot || Number(snapshot) === -1) return table
      try {
        const entry = { dwSize: koffi.sizeof(PE32) }
        let found = process32First(snapshot, entry)
        while (found) {
          table.set(entry.th32ProcessID, {
            parent: entry.th32ParentProcessID,
            exe: readExeName(entry.szExeFile),
          })
          entry.dwSize = koffi.sizeof(PE32)
          found = process32Next(snapshot, entry)
        }
      } finally {
        closeHandle(snapshot)
      }
      return table
    }

    /**
     * Every pid on this process's ancestry that runs the same executable as the
     * shell, which is what the Desktop window belongs to.
     */
    const shellPids = () => {
      const table = processTable()
      const self = basename(process.execPath).toLowerCase()
      const pids = new Set()
      let pid = process.pid
      for (let depth = 0; depth < 8; depth += 1) {
        const entry = table.get(pid)
        if (entry === undefined) break
        if (String(entry.exe).toLowerCase() === self) pids.add(pid)
        pid = entry.parent
        if (!pid) break
      }
      return pids
    }

    /** Top-level visible windows owned by the given pids. */
    const shellWindows = (pids) => {
      const handles = []
      const callback = koffi.register((hwnd) => {
        const owner = [0]
        windowPid(hwnd, owner)
        if (!pids.has(owner[0])) return true
        if (!isVisible(hwnd)) return true
        if (textLength(hwnd) <= 0) return true
        handles.push(Number(hwnd))
        return true
      }, koffi.pointer(enumProc))
      try {
        enumWindows(callback, 0)
      } finally {
        koffi.unregister(callback)
      }
      return handles
    }

    win32Binding = {
      sizeOfFlashInfo: () => koffi.sizeof(FLASHWINFO),
      shellPids,
      shellWindows,
      foreground: () => Number(foreground()),
      isWindow: (hwnd) => isWindow(hwnd),
      flash: (hwnd, size) =>
        flashWindowEx({
          cbSize: size,
          hwnd,
          dwFlags: FLASHW_ALL | FLASHW_TIMERNOFG,
          uCount: 0,
          dwTimeout: 0,
        }),
      stopFlash: (hwnd, size) =>
        flashWindowEx({ cbSize: size, hwnd, dwFlags: 0, uCount: 0, dwTimeout: 0 }),
    }
    return win32Binding
  } catch (error) {
    win32Binding = { error }
    return win32Binding
  }
}

/** Escape one single-quoted PowerShell literal. */
function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

/** Escape text for the toast XML document. */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Show a Windows toast attributed to the shell's AppUserModelID.
 *
 * WinRT is not reachable from a plain Node runtime, so this runs the toast in a
 * short-lived hidden PowerShell process. The child must stay attached: a
 * detached, `unref`'d child exits without ever delivering the toast and hides
 * its exit status. It is not awaited, so the turn never waits for it.
 *
 * @param title - Toast headline.
 * @param body - Toast body text.
 * @param appUserModelId - AUMID the notification is attributed to.
 * @param onFailure - Receives the reason a toast could not be raised.
 */
function showToast(title, body, appUserModelId, onFailure) {
  const xml = [
    '<toast>',
    '<visual><binding template="ToastGeneric">',
    `<text>${escapeXml(title)}</text>`,
    `<text>${escapeXml(body)}</text>`,
    '</binding></visual>',
    '</toast>',
  ].join('')

  const script = [
    '$ErrorActionPreference = "Stop"',
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
    '[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '$document = New-Object Windows.Data.Xml.Dom.XmlDocument',
    `$document.LoadXml(${quotePowerShell(xml)})`,
    '$toast = New-Object Windows.UI.Notifications.ToastNotification $document',
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(${quotePowerShell(appUserModelId)}).Show($toast)`,
  ].join('\n')

  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  try {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, stdio: 'ignore' },
    )
    child.on('error', (error) => onFailure?.(`spawn: ${error.message}`))
    child.on('exit', (code, signal) => {
      if (code === 0) return
      onFailure?.(`powershell exit ${String(code)}${signal === null ? '' : ` signal ${signal}`}`)
    })
    // A helper that never settles must not hold a handle indefinitely.
    const guard = setTimeout(() => {
      try {
        child.kill()
      } catch {
        // Already gone.
      }
    }, 15000)
    guard.unref?.()
    child.once('exit', () => clearTimeout(guard))
  } catch (error) {
    onFailure?.(`spawn threw: ${error.message}`)
  }
}

/**
 * Whether a session was created as a subagent rather than by the user.
 * @param header - the session's creation metadata.
 */
function isSubagentSession(header) {
  if (header?.origin === 'subagent') return true
  return typeof header?.delegationDepth === 'number' && header.delegationDepth > 0
}

/**
 * Install the turn-end listener.
 * @param ctx - Host Cordis context.
 * @param rawConfig - The row's `config` object.
 */
export function apply(ctx, rawConfig) {
  const win32 = createWin32()
  if (win32?.error !== undefined) {
    ctx.logger?.warn?.('turn-alert: taskbar flash unavailable: %s', win32.error.message)
  }

  /** One alert per cooldown window, so a burst of turns stays quiet. */
  let lastAlertAt = 0

  /** Whether the Desktop window currently owns the foreground. */
  const shellIsFocused = () => {
    if (win32 === undefined || win32.error !== undefined) return false
    try {
      const pids = win32.shellPids()
      if (pids.size === 0) return false
      return win32.shellWindows(pids).includes(win32.foreground())
    } catch {
      return false
    }
  }

  /** Flash every visible shell window; the OS stops the flash on focus. */
  const flashTaskbar = () => {
    if (win32 === undefined || win32.error !== undefined) return
    try {
      const pids = win32.shellPids()
      if (pids.size === 0) return
      const size = win32.sizeOfFlashInfo()
      for (const hwnd of win32.shellWindows(pids)) {
        if (!win32.isWindow(hwnd)) continue
        win32.flash(hwnd, size)
        // A bounded flash keeps a stale highlight from outliving the moment.
        const timer = setTimeout(() => {
          try {
            if (win32.isWindow(hwnd)) win32.stopFlash(hwnd, size)
          } catch {
            // The window may have closed first.
          }
        }, 6000)
        timer.unref?.()
      }
    } catch {
      // Attention is cosmetic; never fail a turn for it.
    }
  }

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return

    // Live edits do not restart this plugin, so the row's values are re-read
    // for every turn instead of being captured once in `apply`.
    const config = resolveConfig(rawConfig)
    if (!config.enabled) return

    const reason = event.data?.reason?.kind
    const header = session?.header
    const tag = `session=${session?.id} reason=${String(reason)} origin=${String(header?.origin)} depth=${String(header?.delegationDepth)}`
    if (typeof reason !== 'string') {
      if (config.trace) trace(`SKIP bad-reason ${tag}`)
      return
    }
    if (!ALERTABLE_REASONS.has(reason)) {
      if (config.trace) trace(`SKIP reason-not-alertable ${tag}`)
      return
    }
    if (reason === 'error' && !config.alertOnError) {
      if (config.trace) trace(`SKIP alertOnError=false ${tag}`)
      return
    }
    if (!config.includeSubagents && isSubagentSession(header)) {
      if (config.trace) trace(`SKIP subagent ${tag}`)
      return
    }

    const now = Date.now()
    if (now - lastAlertAt < config.cooldownSeconds * 1000) {
      if (config.trace) trace(`SKIP cooldown (${now - lastAlertAt}ms) ${tag}`)
      return
    }
    if (config.skipWhenFocused && shellIsFocused()) {
      if (config.trace) trace(`SKIP focused ${tag}`)
      return
    }

    // Recorded only after every skip, so a suppressed turn does not consume the
    // cooldown and silence the next real one.
    lastAlertAt = now

    if (config.trace) trace(`ALERT ${tag} flash=${config.flashTaskbar} notify=${config.notify}`)
    if (config.flashTaskbar) flashTaskbar()

    if (config.notify) {
      const failed = reason !== 'completed'
      const language = resolveLanguage(ctx, config.language)
      const copy = MESSAGES[language] ?? MESSAGES[FALLBACK_LANGUAGE]
      const sessionTitle = config.titleFromSession ? readSessionTitle(ctx, session) : undefined
      if (config.trace) {
        trace(`LANG ${language} (setting=${config.language}) title=${sessionTitle === undefined ? '(none)' : JSON.stringify(sessionTitle)}`)
      }

      // The custom template wins over both sources; then the conversation
      // title; then the built-in copy. `{title}` still expands to the session
      // title inside a custom template so one string can combine both.
      const values = {
        title: sessionTitle ?? '',
        reason,
        session: session?.id === undefined ? '' : String(session.id),
      }
      const builtinTitle = failed ? copy.problemTitle : copy.title
      const builtinBody = failed ? copy.problemBody : copy.body
      const headline = config.customTitle.trim() === ''
        ? (sessionTitle ?? builtinTitle)
        : fillTemplate(config.customTitle, values).trim()
      const detail = config.customBody.trim() === ''
        ? builtinBody
        : fillTemplate(config.customBody, values).trim()

      showToast(
        headline === '' ? builtinTitle : headline,
        detail === '' ? builtinBody : detail,
        config.appUserModelId,
        (why) => {
          ctx.logger?.warn?.('turn-alert: toast failed: %s', why)
          if (config.trace) trace(`TOAST-FAILED ${why} ${tag}`)
        },
      )
    }
  })
}
