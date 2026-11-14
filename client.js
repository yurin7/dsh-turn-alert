/**
 * Turn alert settings page.
 *
 * The Host half owns the alert behavior and its Config schema; this page is the
 * browser half that renders those switches in Settings. It reads and writes the
 * `turn-alert` settings namespace through `ctx.configForms`, so a change applies
 * live: the schema fields are volatile, and the Host updates the running
 * instance instead of restarting it.
 *
 * Written as a plain client module: the launcher loads it through
 * `window.__ModuleLoader__`, and React comes from the browser module table.
 */

window.__ModuleLoader__.load({
  id: 'dsh-turn-alert',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    /** Settings namespace owned by the Host plugin row. */
    const NS = 'turn-alert'

    /** Dictionary namespace owned by this page. */
    const COPY_NS = 'turn-alert'

    /**
     * Page copy per language.
     *
     * `zh` and `en` are required by the locale service; the rest are optional and
     * fall back along the service's own chain. Keeping the table inline rather
     * than importing locale JSON is what lets this file stay a plain client
     * module with no build step.
     */
    const COPY = {
      zh: {
        sectionTitle: '回答完成提醒',
        sectionDesc: '一轮对话结束时，闪烁任务栏图标并弹出系统通知。',
        enabled: '启用回答完成提醒',
        enabledHint: '总开关。关闭后下方设置会被禁用。',
        flashTaskbar: '闪烁任务栏图标',
        flashTaskbarHint: '一轮结束时让任务栏图标闪烁，直到你切回窗口。',
        notify: '系统通知',
        notifyHint: '弹出 Windows 通知，归属 DeepSeek Harness。',
        skipWhenFocused: '窗口在前台时不提醒',
        skipWhenFocusedHint: '默认关闭：即使你正看着窗口，也会提醒。',
        includeSubagents: '子代理也提醒',
        includeSubagentsHint: '默认关闭：子代理是内部调度，不算你在等的回答。',
        alertOnError: '失败时也提醒',
        alertOnErrorHint: '一轮以错误结束时，同样闪烁并通知。',
        cooldownSeconds: '最短间隔（秒）',
        cooldownSecondsHint: '两次提醒之间至少间隔这么久，连发时只提醒一次。',
        language: '通知语言',
        languageHint: '默认为自动，跟随界面语言。',
        languageAuto: '自动（跟随界面）',
        loading: '正在读取设置…',
        unavailable: '提醒插件未运行，因此没有可编辑的设置。',
        readonly: '当前环境下配置只读。',
        saveFailed: '「{field}」未能保存，可能是配置被上层覆盖。',
        errorPrefix: '保存失败：',
        titleFromSession: '标题用当前对话标题',
        titleFromSessionHint: '开启后通知标题就是这场对话的标题。',
        customTitle: '自定义标题',
        customTitleHint: '留空则使用对话标题或内置文案。支持 {title} {reason} {session}。',
        customTitlePlaceholder: '例如：{title} 已回复',
        customBody: '自定义正文',
        customBodyHint: '留空则使用内置文案。支持 {title} {reason} {session}。',
        customBodyPlaceholder: '例如：可以回来看了',
      },
      en: {
        sectionTitle: 'Turn alert',
        sectionDesc: 'Flashes the taskbar button and raises a system notification when a turn finishes.',
        enabled: 'Enable turn alerts',
        enabledHint: 'Master switch. Turning it off disables the settings below.',
        flashTaskbar: 'Flash the taskbar button',
        flashTaskbarHint: 'Flashes until you switch back to the window.',
        notify: 'System notification',
        notifyHint: 'Raises a Windows toast attributed to DeepSeek Harness.',
        skipWhenFocused: 'Stay silent while the window is focused',
        skipWhenFocusedHint: 'Off by default: you are alerted even while watching the window.',
        includeSubagents: 'Include subagent turns',
        includeSubagentsHint: 'Off by default: subagents are internal delegation, not a reply you await.',
        alertOnError: 'Alert on failure',
        alertOnErrorHint: 'Also flashes and notifies when a turn ends in error.',
        cooldownSeconds: 'Minimum gap (seconds)',
        cooldownSecondsHint: 'Alerts are at least this far apart, so a burst rings once.',
        language: 'Notification language',
        languageHint: 'Automatic follows the interface language.',
        languageAuto: 'Automatic (follow interface)',
        loading: 'Reading settings…',
        unavailable: 'The plugin is not running, so there is nothing to edit.',
        readonly: 'Configuration is read-only in this environment.',
        saveFailed: '“{field}” could not be saved; a higher layer may override it.',
        errorPrefix: 'Save failed: ',
        titleFromSession: 'Use the conversation title',
        titleFromSessionHint: 'The notification headline becomes this conversation title.',
        customTitle: 'Custom headline',
        customTitleHint: 'Empty uses the conversation title or built-in copy. Supports {title}, {reason}, {session}.',
        customTitlePlaceholder: 'e.g. {title} replied',
        customBody: 'Custom body',
        customBodyHint: 'Empty keeps the built-in copy. Supports {title}, {reason}, {session}.',
        customBodyPlaceholder: 'e.g. Ready to read',
      },
      ja: {
        sectionTitle: '応答完了の通知',
        sectionDesc: 'ターン終了時にタスクバーを点滅させ、システム通知を表示します。',
        enabled: '応答完了の通知を有効化',
        enabledHint: '全体スイッチ。オフにすると以下の設定は無効になります。',
        flashTaskbar: 'タスクバーを点滅',
        flashTaskbarHint: 'ウィンドウに戻るまで点滅します。',
        notify: 'システム通知',
        notifyHint: 'DeepSeek Harness 名義で Windows の通知を表示します。',
        skipWhenFocused: 'ウィンドウが前面のときは通知しない',
        skipWhenFocusedHint: '既定はオフ：見ている最中でも通知します。',
        includeSubagents: 'サブエージェントも通知',
        includeSubagentsHint: '既定はオフ：内部の委譲であり、待っている応答ではありません。',
        alertOnError: '失敗時も通知',
        alertOnErrorHint: 'エラーで終わったターンも点滅・通知します。',
        cooldownSeconds: '最短間隔（秒）',
        cooldownSecondsHint: '連続しても、この間隔で一度だけ通知します。',
        language: '通知の言語',
        languageHint: '自動は画面の言語に従います。',
        languageAuto: '自動（画面の言語）',
        loading: '設定を読み込み中…',
        unavailable: 'プラグインが動作していないため、編集できる設定はありません。',
        readonly: 'この環境では設定は読み取り専用です。',
        saveFailed: '「{field}」を保存できませんでした。上位の設定に上書きされている可能性があります。',
        errorPrefix: '保存に失敗しました：',
        titleFromSession: '会話タイトルを件名にする',
        titleFromSessionHint: '通知の見出しがこの会話のタイトルになります。',
        customTitle: '件名をカスタム',
        customTitleHint: '空欄なら会話タイトルか標準文言。{title} {reason} {session} が使えます。',
        customTitlePlaceholder: '例：{title} が返信しました',
        customBody: '本文をカスタム',
        customBodyHint: '空欄なら標準文言。{title} {reason} {session} が使えます。',
        customBodyPlaceholder: '例：確認できます',
      },
      ko: {
        sectionTitle: '응답 완료 알림',
        sectionDesc: '턴이 끝나면 작업 표시줄을 깜박이고 시스템 알림을 표시합니다.',
        enabled: '응답 완료 알림 사용',
        enabledHint: '전체 스위치. 끄면 아래 설정을 사용할 수 없습니다.',
        flashTaskbar: '작업 표시줄 깜박임',
        flashTaskbarHint: '창으로 돌아올 때까지 깜박입니다.',
        notify: '시스템 알림',
        notifyHint: 'DeepSeek Harness 이름으로 Windows 알림을 표시합니다.',
        skipWhenFocused: '창이 앞에 있을 때는 알리지 않음',
        skipWhenFocusedHint: '기본값은 끔: 보고 있어도 알립니다.',
        includeSubagents: '하위 에이전트도 알림',
        includeSubagentsHint: '기본값은 끔: 내부 위임이며 기다리는 응답이 아닙니다.',
        alertOnError: '실패 시에도 알림',
        alertOnErrorHint: '오류로 끝난 턴도 깜박이고 알립니다.',
        cooldownSeconds: '최소 간격(초)',
        cooldownSecondsHint: '연속되어도 이 간격으로 한 번만 알립니다.',
        language: '알림 언어',
        languageHint: '자동은 화면 언어를 따릅니다.',
        languageAuto: '자동(화면 언어)',
        loading: '설정을 읽는 중…',
        unavailable: '플러그인이 실행 중이 아니어서 편집할 설정이 없습니다.',
        readonly: '이 환경에서는 설정을 읽기만 할 수 있습니다.',
        saveFailed: '“{field}”을(를) 저장하지 못했습니다. 상위 설정이 덮어쓸 수 있습니다.',
        errorPrefix: '저장 실패: ',
        titleFromSession: '대화 제목을 제목으로 사용',
        titleFromSessionHint: '알림 제목이 이 대화의 제목이 됩니다.',
        customTitle: '사용자 지정 제목',
        customTitleHint: '비우면 대화 제목이나 기본 문구를 씁니다. {title} {reason} {session} 사용 가능.',
        customTitlePlaceholder: '예: {title} 답변 완료',
        customBody: '사용자 지정 본문',
        customBodyHint: '비우면 기본 문구를 씁니다. {title} {reason} {session} 사용 가능.',
        customBodyPlaceholder: '예: 확인할 수 있습니다',
      },
      es: {
        sectionTitle: 'Aviso al terminar el turno',
        sectionDesc: 'Hace parpadear la barra de tareas y muestra una notificación al terminar un turno.',
        enabled: 'Activar avisos de turno',
        enabledHint: 'Interruptor general. Al desactivarlo se bloquean los ajustes de abajo.',
        flashTaskbar: 'Parpadear la barra de tareas',
        flashTaskbarHint: 'Parpadea hasta que vuelvas a la ventana.',
        notify: 'Notificación del sistema',
        notifyHint: 'Muestra una notificación de Windows atribuida a DeepSeek Harness.',
        skipWhenFocused: 'Silencio si la ventana está en primer plano',
        skipWhenFocusedHint: 'Desactivado por defecto: te avisa aunque estés mirando.',
        includeSubagents: 'Incluir subagentes',
        includeSubagentsHint: 'Desactivado por defecto: son delegación interna, no una respuesta esperada.',
        alertOnError: 'Avisar también al fallar',
        alertOnErrorHint: 'También parpadea y notifica si el turno acaba en error.',
        cooldownSeconds: 'Intervalo mínimo (segundos)',
        cooldownSecondsHint: 'Los avisos se separan al menos así, para que una ráfaga suene una vez.',
        language: 'Idioma de la notificación',
        languageHint: 'Automático sigue el idioma de la interfaz.',
        languageAuto: 'Automático (seguir interfaz)',
        loading: 'Leyendo la configuración…',
        unavailable: 'El plugin no está en ejecución, así que no hay nada que editar.',
        readonly: 'La configuración es de solo lectura en este entorno.',
        saveFailed: 'No se pudo guardar «{field}»; puede que otra capa lo sobrescriba.',
        errorPrefix: 'Error al guardar: ',
        titleFromSession: 'Usar el título de la conversación',
        titleFromSessionHint: 'El encabezado pasa a ser el título de esta conversación.',
        customTitle: 'Encabezado personalizado',
        customTitleHint: 'Vacío usa el título o el texto integrado. Admite {title}, {reason}, {session}.',
        customTitlePlaceholder: 'p. ej. {title} respondió',
        customBody: 'Cuerpo personalizado',
        customBodyHint: 'Vacío mantiene el texto integrado. Admite {title}, {reason}, {session}.',
        customBodyPlaceholder: 'p. ej. Listo para leer',
      },
      fr: {
        sectionTitle: 'Alerte de fin de tour',
        sectionDesc: 'Fait clignoter la barre des tâches et affiche une notification à la fin d’un tour.',
        enabled: 'Activer les alertes de tour',
        enabledHint: 'Interrupteur général. Le désactiver désactive les réglages ci-dessous.',
        flashTaskbar: 'Faire clignoter la barre des tâches',
        flashTaskbarHint: 'Clignote jusqu’au retour à la fenêtre.',
        notify: 'Notification système',
        notifyHint: 'Affiche une notification Windows attribuée à DeepSeek Harness.',
        skipWhenFocused: 'Silence si la fenêtre est au premier plan',
        skipWhenFocusedHint: 'Désactivé par défaut : vous êtes alerté même en regardant.',
        includeSubagents: 'Inclure les sous-agents',
        includeSubagentsHint: 'Désactivé par défaut : délégation interne, pas une réponse attendue.',
        alertOnError: 'Alerter aussi en cas d’échec',
        alertOnErrorHint: 'Clignote et notifie aussi quand un tour se termine en erreur.',
        cooldownSeconds: 'Intervalle minimal (secondes)',
        cooldownSecondsHint: 'Les alertes sont espacées d’au moins cela, une rafale ne sonne qu’une fois.',
        language: 'Langue de la notification',
        languageHint: 'Automatique suit la langue de l’interface.',
        languageAuto: 'Automatique (suivre l’interface)',
        loading: 'Lecture des réglages…',
        unavailable: 'Le plugin n’est pas actif : rien à modifier.',
        readonly: 'La configuration est en lecture seule dans cet environnement.',
        saveFailed: '« {field} » n’a pas pu être enregistré ; une couche supérieure l’écrase peut-être.',
        errorPrefix: 'Échec de l’enregistrement : ',
        titleFromSession: 'Utiliser le titre de la conversation',
        titleFromSessionHint: 'L\'en-tête devient le titre de cette conversation.',
        customTitle: 'En-tête personnalisé',
        customTitleHint: 'Vide utilise le titre ou le texte intégré. Accepte {title}, {reason}, {session}.',
        customTitlePlaceholder: 'ex. {title} a répondu',
        customBody: 'Corps personnalisé',
        customBodyHint: 'Vide garde le texte intégré. Accepte {title}, {reason}, {session}.',
        customBodyPlaceholder: 'ex. Prêt à lire',
      },
      de: {
        sectionTitle: 'Benachrichtigung nach Antwort',
        sectionDesc: 'Lässt die Taskleiste blinken und zeigt eine Systembenachrichtigung, wenn ein Turn endet.',
        enabled: 'Turn-Benachrichtigungen aktivieren',
        enabledHint: 'Hauptschalter. Ausschalten deaktiviert die Einstellungen darunter.',
        flashTaskbar: 'Taskleiste blinken lassen',
        flashTaskbarHint: 'Blinkt, bis du zum Fenster zurückkehrst.',
        notify: 'Systembenachrichtigung',
        notifyHint: 'Zeigt eine Windows-Benachrichtigung im Namen von DeepSeek Harness.',
        skipWhenFocused: 'Stumm, solange das Fenster im Vordergrund ist',
        skipWhenFocusedHint: 'Standardmäßig aus: du wirst auch beim Zusehen benachrichtigt.',
        includeSubagents: 'Subagenten einbeziehen',
        includeSubagentsHint: 'Standardmäßig aus: interne Delegation, keine erwartete Antwort.',
        alertOnError: 'Auch bei Fehlern benachrichtigen',
        alertOnErrorHint: 'Blinkt und benachrichtigt auch bei einem Fehler am Turn-Ende.',
        cooldownSeconds: 'Mindestabstand (Sekunden)',
        cooldownSecondsHint: 'Benachrichtigungen liegen mindestens so weit auseinander, eine Serie klingelt einmal.',
        language: 'Sprache der Benachrichtigung',
        languageHint: 'Automatisch folgt der Oberflächensprache.',
        languageAuto: 'Automatisch (Oberfläche folgen)',
        loading: 'Einstellungen werden gelesen…',
        unavailable: 'Das Plugin läuft nicht, es gibt nichts zu bearbeiten.',
        readonly: 'Die Konfiguration ist in dieser Umgebung schreibgeschützt.',
        saveFailed: '„{field}“ konnte nicht gespeichert werden; eine höhere Ebene überschreibt sie eventuell.',
        errorPrefix: 'Speichern fehlgeschlagen: ',
        titleFromSession: 'Gesprächstitel verwenden',
        titleFromSessionHint: 'Die Überschrift wird der Titel dieses Gesprächs.',
        customTitle: 'Eigene Überschrift',
        customTitleHint: 'Leer nutzt den Titel oder den Standardtext. Unterstützt {title}, {reason}, {session}.',
        customTitlePlaceholder: 'z. B. {title} hat geantwortet',
        customBody: 'Eigener Text',
        customBodyHint: 'Leer behält den Standardtext. Unterstützt {title}, {reason}, {session}.',
        customBodyPlaceholder: 'z. B. Bereit zum Lesen',
      },
      ru: {
        sectionTitle: 'Уведомление о завершении',
        sectionDesc: 'Мигает кнопкой на панели задач и показывает системное уведомление по завершении хода.',
        enabled: 'Включить уведомления о ходе',
        enabledHint: 'Главный переключатель. Отключение блокирует настройки ниже.',
        flashTaskbar: 'Мигать на панели задач',
        flashTaskbarHint: 'Мигает, пока вы не вернётесь в окно.',
        notify: 'Системное уведомление',
        notifyHint: 'Показывает уведомление Windows от имени DeepSeek Harness.',
        skipWhenFocused: 'Молчать, пока окно в фокусе',
        skipWhenFocusedHint: 'По умолчанию выключено: уведомление придёт, даже если вы смотрите.',
        includeSubagents: 'Учитывать субагентов',
        includeSubagentsHint: 'По умолчанию выключено: это внутренняя делегация, а не ожидаемый ответ.',
        alertOnError: 'Уведомлять и при ошибке',
        alertOnErrorHint: 'Мигает и уведомляет также при завершении с ошибкой.',
        cooldownSeconds: 'Минимальный интервал (секунды)',
        cooldownSecondsHint: 'Уведомления разделены как минимум этим интервалом, серия звонит один раз.',
        language: 'Язык уведомления',
        languageHint: 'Автоматически следует языку интерфейса.',
        languageAuto: 'Автоматически (как интерфейс)',
        loading: 'Чтение настроек…',
        unavailable: 'Плагин не запущен, редактировать нечего.',
        readonly: 'В этой среде конфигурация доступна только для чтения.',
        saveFailed: 'Не удалось сохранить «{field}»; возможно, её перекрывает верхний слой.',
        errorPrefix: 'Ошибка сохранения: ',
        titleFromSession: 'Использовать название беседы',
        titleFromSessionHint: 'Заголовок уведомления станет названием этой беседы.',
        customTitle: 'Свой заголовок',
        customTitleHint: 'Пусто — название беседы или встроенный текст. Поддерживает {title}, {reason}, {session}.',
        customTitlePlaceholder: 'напр. {title} ответил',
        customBody: 'Свой текст',
        customBodyHint: 'Пусто — встроенный текст. Поддерживает {title}, {reason}, {session}.',
        customBodyPlaceholder: 'напр. Можно читать',
      },
      pt: {
        sectionTitle: 'Aviso ao concluir',
        sectionDesc: 'Pisca a barra de tarefas e mostra uma notificação do sistema quando um turno termina.',
        enabled: 'Ativar avisos de turno',
        enabledHint: 'Interruptor geral. Desligá-lo desativa as opções abaixo.',
        flashTaskbar: 'Piscar a barra de tarefas',
        flashTaskbarHint: 'Pisca até você voltar à janela.',
        notify: 'Notificação do sistema',
        notifyHint: 'Mostra uma notificação do Windows atribuída ao DeepSeek Harness.',
        skipWhenFocused: 'Silêncio com a janela em primeiro plano',
        skipWhenFocusedHint: 'Desligado por padrão: você é avisado mesmo enquanto olha.',
        includeSubagents: 'Incluir subagentes',
        includeSubagentsHint: 'Desligado por padrão: é delegação interna, não uma resposta esperada.',
        alertOnError: 'Avisar também em falha',
        alertOnErrorHint: 'Também pisca e notifica quando o turno termina em erro.',
        cooldownSeconds: 'Intervalo mínimo (segundos)',
        cooldownSecondsHint: 'Os avisos ficam ao menos assim distantes, então uma rajada toca uma vez.',
        language: 'Idioma da notificação',
        languageHint: 'Automático segue o idioma da interface.',
        languageAuto: 'Automático (seguir interface)',
        loading: 'Lendo as configurações…',
        unavailable: 'O plugin não está em execução, não há nada para editar.',
        readonly: 'A configuração é somente leitura neste ambiente.',
        saveFailed: 'Não foi possível salvar “{field}”; outra camada pode estar sobrepondo.',
        errorPrefix: 'Falha ao salvar: ',
        titleFromSession: 'Usar o título da conversa',
        titleFromSessionHint: 'O título da notificação passa a ser o desta conversa.',
        customTitle: 'Título personalizado',
        customTitleHint: 'Vazio usa o título ou o texto integrado. Aceita {title}, {reason}, {session}.',
        customTitlePlaceholder: 'ex. {title} respondeu',
        customBody: 'Corpo personalizado',
        customBodyHint: 'Vazio mantém o texto integrado. Aceita {title}, {reason}, {session}.',
        customBodyPlaceholder: 'ex. Pronto para ler',
      },
    }

    /**
     * The switches this page shows, in reading order.
     *
     * Each entry is a Config key, which doubles as its copy key, so a language
     * carries one entry per switch rather than one per label variant.
     */
    const SWITCHES = ['enabled', 'flashTaskbar', 'notify', 'skipWhenFocused', 'includeSubagents', 'alertOnError']

    /** Numeric fields rendered as a small text input. */
    const NUMBERS = ['cooldownSeconds']

    /** Language ids the notification can use, in selector order. */
    const LANGUAGE_IDS = ['auto', 'zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt']

    /** Read a value, falling back when the Host has not answered yet. */
    const pick = (value, fallback) => (value === undefined ? fallback : value)

    /** Fill `{name}` placeholders in a copy string. */
    const fill = (text, values) =>
      String(text).replace(/\{(\w+)\}/gu, (match, key) => (values[key] === undefined ? match : String(values[key])))

    /**
     * One settings section backed by a volatile Config schema.
     * @param props - the injected `form` and translator.
     */
    function TurnAlertPage(props) {
      const { form, t } = props
      // Resolve copy through the locale service on every render, so switching
      // the interface language re-renders this page without a reload.
      const c = React.useMemo(() => ({
        saveFailed: t('saveFailed'),
        errorPrefix: t('errorPrefix'),
        unavailable: t('unavailable'),
        loading: t('loading'),
        readonly: t('readonly'),
        sectionTitle: t('sectionTitle'),
        sectionDesc: t('sectionDesc'),
        language: t('language'),
        languageHint: t('languageHint'),
        languageAuto: t('languageAuto'),
        customTitlePlaceholder: t('customTitlePlaceholder'),
        customBodyPlaceholder: t('customBodyPlaceholder'),
        label: (field) => t(field),
        hint: (field) => t(`${field}Hint`),
      }), [t])

      const subscribe = React.useCallback((listener) => form.subscribe(listener), [form])
      const snapshot = React.useSyncExternalStore(
        subscribe,
        () => form.getSnapshot(),
        () => form.getSnapshot(),
      )

      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(null)

      const write = React.useCallback(
        async (field, value) => {
          setBusy(field)
          setError(null)
          try {
            const accepted = await form.set(field, value)
            if (!accepted) setError(fill(c.saveFailed, { field }))
          } catch (cause) {
            setError(`${c.errorPrefix}${cause instanceof Error ? cause.message : String(cause)}`)
          } finally {
            setBusy(null)
          }
        },
        [form, c],
      )

      if (snapshot.status === 'unavailable') {
        return h('div', { style: s.page }, h('p', { style: s.empty }, c.unavailable))
      }
      if (snapshot.status === 'loading' || snapshot.value === undefined) {
        return h('div', { style: s.page }, h('p', { style: s.empty }, c.loading))
      }

      const value = snapshot.value
      const readOnly = snapshot.writable === false
      const masterOn = pick(value.enabled, true)
      // Everything below the master switch is inert while alerts are off, so a
      // half-edited card never implies an alert that cannot fire.
      const locked = readOnly || !masterOn
      const busyNow = busy !== null
      const languageOptions = LANGUAGE_IDS.map((id) => ({
        id,
        label: id === 'auto' ? c.languageAuto : id,
      }))

      return h('div', { style: s.page },
        // The page head sits outside the card, matching how the shell's own
        // settings pages title themselves: the section is already named in the
        // nav rail, so this repeats it as a page heading rather than as a card
        // caption.
        h('div', { style: s.pageHead },
          h('div', { style: s.pageHeadText },
            h('h2', { style: s.pageTitle }, c.sectionTitle),
            h('p', { style: s.pageDesc }, c.sectionDesc)),
        ),

        h('div', { style: s.card },
          // The master switch: on its own row, styled as the card's primary
          // control rather than as one entry among peers.
          h('div', { style: s.masterRow },
            h('span', { style: s.rowText },
              h('span', { style: s.masterTitle }, c.label('enabled')),
              h('span', { style: s.rowHint }, c.hint('enabled'))),
            h(Switch, {
              title: c.label('enabled'),
              checked: masterOn,
              disabled: readOnly || busyNow,
              onChange: (next) => write('enabled', next),
            }),
          ),

          // The dependent settings, dimmed and inert while the master is off.
          h('div', { style: masterOn ? s.group : { ...s.group, ...s.groupLocked } },
            SWITCHES.filter((field) => field !== 'enabled').map((field) => h(Row, {
              key: field,
              title: c.label(field),
              hint: c.hint(field),
              checked: pick(value[field], false),
              disabled: locked || busyNow,
              onChange: (next) => write(field, next),
            })),
            NUMBERS.map((field) => h(NumberRow, {
              key: field,
              title: c.label(field),
              hint: c.hint(field),
              value: pick(value[field], 3),
              disabled: locked || busyNow,
              onCommit: (next) => write(field, next),
            })),
            h(SelectRow, {
              title: c.language,
              hint: c.languageHint,
              value: pick(value.language, 'auto'),
              options: languageOptions,
              disabled: locked || busyNow,
              onChange: (next) => write('language', next),
            }),
            h(Row, {
              title: c.label('titleFromSession'),
              hint: c.hint('titleFromSession'),
              checked: pick(value.titleFromSession, true),
              disabled: locked || busyNow,
              onChange: (next) => write('titleFromSession', next),
            }),
            h(TextRow, {
              title: c.label('customTitle'),
              hint: c.hint('customTitle'),
              placeholder: c.customTitlePlaceholder,
              value: pick(value.customTitle, ''),
              disabled: locked || busyNow,
              onCommit: (next) => write('customTitle', next),
            }),
            h(TextRow, {
              title: c.label('customBody'),
              hint: c.hint('customBody'),
              placeholder: c.customBodyPlaceholder,
              value: pick(value.customBody, ''),
              disabled: locked || busyNow,
              onCommit: (next) => write('customBody', next),
            }),
          ),
          error === null ? null : h('p', { style: s.error }, error),
          readOnly ? h('p', { style: s.empty }, c.readonly) : null,
        ),
      )
    }

    /** The switch control on its own, shared by the master row and every Row. */
    function Switch(props) {
      const { title, checked, disabled, onChange } = props
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked,
        'aria-label': title,
        disabled,
        onClick: () => onChange(!checked),
        style: {
          ...s.track,
          background: checked ? 'var(--dsw-alias-accent-info, #4d6bfe)' : 'var(--dsw-alias-border-weak, #444)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        },
      }, h('span', { style: { ...s.knob, transform: checked ? 'translateX(16px)' : 'translateX(0)' } }))
    }

    /** A labelled switch with a description underneath. */
    function Row(props) {
      const { title, hint, checked, disabled, onChange } = props
      return h('label', { style: s.row },
        h('span', { style: s.rowText },
          h('span', { style: s.rowTitle }, title),
          hint === '' ? null : h('span', { style: s.rowHint }, hint)),
        h(Switch, { title, checked, disabled, onChange }),
      )
    }

    /** A number input that writes on blur or Enter rather than per keystroke. */
    function NumberRow(props) {
      const { title, hint, value, disabled, onCommit } = props
      const [draft, setDraft] = React.useState(String(value))
      React.useEffect(() => {
        setDraft(String(value))
      }, [value])
      const commit = () => {
        const parsed = Number(draft)
        if (!Number.isFinite(parsed) || parsed < 0) {
          setDraft(String(value))
          return
        }
        if (parsed !== value) onCommit(parsed)
      }
      return h('div', { style: s.row },
        h('span', { style: s.rowText },
          h('span', { style: s.rowTitle }, title),
          hint === '' ? null : h('span', { style: s.rowHint }, hint)),
        h('input', {
          type: 'number',
          min: 0,
          step: 1,
          value: draft,
          disabled,
          'aria-label': title,
          onChange: (event) => setDraft(event.target.value),
          onBlur: commit,
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
          },
          style: s.input,
        }),
      )
    }

    /**
     * A select styled like the host's own pickers.
     *
     * A native `<select>` cannot be themed: Chromium draws its dropdown with
     * the OS palette, so on a dark host it opened a white menu. This is a
     * button plus a portal menu built from the same alias tokens the host uses,
     * so it follows light/dark and the accent colour.
     */
    function SelectRow(props) {
      const { title, hint, value, options, disabled, onChange } = props
      const [open, setOpen] = React.useState(false)
      const [anchor, setAnchor] = React.useState(null)
      const triggerRef = React.useRef(null)
      const menuRef = React.useRef(null)
      const active = options.find((option) => option.id === value)
      const activeLabel = active === undefined ? value : active.label

      // Position the menu under the trigger, right-aligned like the host's own.
      React.useLayoutEffect(() => {
        if (!open) return
        const place = () => {
          const node = triggerRef.current
          if (node === null) return
          const box = node.getBoundingClientRect()
          setAnchor({ top: box.bottom + 4, right: window.innerWidth - box.right })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [open])

      // Close on an outside click or Escape, like the host menu does.
      React.useEffect(() => {
        if (!open) return
        const onDown = (event) => {
          if (triggerRef.current?.contains(event.target)) return
          if (menuRef.current?.contains(event.target)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      const menu = open && anchor !== null
        ? ReactDOM.createPortal(
            h('div', {
              ref: menuRef,
              role: 'menu',
              'aria-label': title,
              style: { ...s.menu, top: `${anchor.top}px`, right: `${anchor.right}px` },
            }, options.map((option) => h('button', {
              key: option.id,
              type: 'button',
              role: 'menuitemradio',
              'aria-checked': option.id === value,
              style: option.id === value ? { ...s.menuItem, ...s.menuItemActive } : s.menuItem,
              onMouseEnter: (event) => {
                if (option.id === value) return
                event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.14))'
              },
              onMouseLeave: (event) => {
                if (option.id === value) return
                event.currentTarget.style.background = 'transparent'
              },
              onClick: () => {
                setOpen(false)
                if (option.id !== value) onChange(option.id)
              },
            }, option.label))),
            document.body,
          )
        : null

      return h('div', { style: s.row },
        h('span', { style: s.rowText },
          h('span', { style: s.rowTitle }, title),
          hint === '' ? null : h('span', { style: s.rowHint }, hint)),
        h('div', { ref: triggerRef, style: s.selectorWrap },
          h('button', {
            type: 'button',
            'aria-haspopup': 'menu',
            'aria-expanded': open,
            'aria-label': title,
            disabled,
            onClick: () => setOpen((previous) => !previous),
            style: { ...s.selector, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 },
          },
            h('span', null, activeLabel),
            h('svg', {
              width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true,
              style: { flex: 'none', transition: 'transform 120ms ease', transform: open ? 'rotate(180deg)' : 'none' },
            }, h('path', {
              d: 'M2.5 4.5 6 8l3.5-3.5',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            })),
          ),
        ),
        menu,
      )
    }

    /**
     * A free-text field that writes on blur or Enter, not per keystroke.
     *
     * Per-keystroke writes would restart the plugin on every character in a
     * profile where the field is not volatile, so the draft stays local until
     * the edit settles.
     */
    function TextRow(props) {
      const { title, hint, placeholder, value, disabled, onCommit } = props
      const [draft, setDraft] = React.useState(value)
      React.useEffect(() => {
        setDraft(value)
      }, [value])
      const commit = () => {
        if (draft !== value) onCommit(draft)
      }
      return h('div', { style: s.rowStack },
        h('div', { style: s.rowText },
          h('span', { style: s.rowTitle }, title),
          hint === '' ? null : h('span', { style: s.rowHint }, hint)),
        h('input', {
          type: 'text',
          value: draft,
          placeholder,
          disabled,
          'aria-label': title,
          onChange: (event) => setDraft(event.target.value),
          onBlur: commit,
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
          },
          style: s.textInput,
        }),
      )
    }

    /** Styles use only host alias tokens, so light and dark both work. */
    const s = {
      page: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '4px 0',
        fontSize: '13px',
      },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '16px',
        borderRadius: '10px',
        background: 'var(--dsw-alias-bg-weak, rgba(127,127,127,0.06))',
        border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.16))',
      },
      // Page head, outside the card: an h2 title with its description under it,
      // the way the settings shell titles its own pages.
      pageHead: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '2px 2px 14px',
      },
      pageHeadText: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
      pageTitle: {
        margin: 0,
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: '26px',
        color: 'var(--dsw-alias-text-default, inherit)',
      },
      pageDesc: {
        margin: 0,
        fontSize: '12.5px',
        lineHeight: 1.55,
        color: 'var(--dsw-alias-text-weak, rgba(127,127,127,0.9))',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '10px 0',
        borderTop: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.12))',
      },
      rowText: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
      rowTitle: { fontSize: '13px', color: 'var(--dsw-alias-text-default, inherit)' },
      // The master switch sits above the dependent group: larger label, no
      // separator above it, and a hairline below to tie the group to it.
      masterRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '10px 0 12px',
        borderTop: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.12))',
        borderBottom: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.12))',
        marginBottom: '2px',
      },
      masterTitle: {
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--dsw-alias-text-default, inherit)',
      },
      group: {
        display: 'flex',
        flexDirection: 'column',
        transition: 'opacity 120ms ease',
      },
      // Dependent settings stay visible but read as unavailable.
      groupLocked: {
        opacity: 0.45,
        pointerEvents: 'none',
        userSelect: 'none',
      },
      rowHint: {
        fontSize: '11.5px',
        lineHeight: 1.45,
        color: 'var(--dsw-alias-text-weak, rgba(127,127,127,0.9))',
      },
      track: {
        flex: '0 0 auto',
        position: 'relative',
        width: '34px',
        height: '18px',
        borderRadius: '9px',
        border: 'none',
        padding: 0,
        transition: 'background 120ms ease',
      },
      knob: {
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'transform 120ms ease',
      },
      input: {
        flex: '0 0 auto',
        width: '72px',
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '13px',
        textAlign: 'right',
        color: 'var(--dsw-alias-text-default, inherit)',
        background: 'var(--dsw-alias-bg-default, transparent)',
        border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.24))',
      },
      // Trigger pill, matching the host's own picker: 36px tall, module
      // background, hover state from the interaction alias.
      selectorWrap: { flex: '0 0 auto', position: 'relative' },
      selector: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        height: '36px',
        padding: '0 14px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-md, 8px)',
        background: 'var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.10))',
        font: 'inherit',
        fontSize: '14px',
        lineHeight: '22px',
        color: 'var(--dsw-alias-label-primary, inherit)',
      },
      // Popover: the host's prominent elevation and module background, so it
      // reads as part of the app instead of the OS dropdown.
      menu: {
        position: 'fixed',
        zIndex: 2147483000,
        minWidth: '180px',
        maxHeight: '320px',
        overflowY: 'auto',
        margin: 0,
        padding: '4px',
        borderRadius: 'var(--dsw-radius-md, 8px)',
        background: 'var(--dsw-alias-bg-module-platform, #2a2d33)',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.24))',
        boxShadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0,0,0,0.35))',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      },
      menuItem: {
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '7px 10px',
        border: 'none',
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        background: 'transparent',
        font: 'inherit',
        fontSize: '13px',
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-primary, inherit)',
        cursor: 'pointer',
      },
      menuItemActive: {
        background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.16))',
        color: 'var(--dsw-alias-label-primary, inherit)',
        fontWeight: 500,
      },
      error: {
        margin: '8px 0 0',
        fontSize: '12px',
        color: 'var(--dsw-alias-text-danger, #e5484d)',
      },
      rowStack: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '10px 0',
        borderTop: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.12))',
      },
      textInput: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        borderRadius: '6px',
        fontSize: '13px',
        color: 'var(--dsw-alias-text-default, inherit)',
        background: 'var(--dsw-alias-bg-default, transparent)',
        border: '1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.24))',
      },
      empty: {
        margin: 0,
        fontSize: '12px',
        color: 'var(--dsw-alias-text-weak, rgba(127,127,127,0.9))',
      },
    }

    return {
      // `configForms` exposes the settings namespace, `locale` translates this
      // page and the notification labels, and `slots` registers the section.
      inject: ['slots', 'configForms', 'locale'],
      apply(ctx) {
        const form = ctx.configForms.get(NS)
        ctx.effect(() => ctx.locale.register(COPY_NS, COPY), 'turn-alert: dictionaries')
        const t = ctx.locale.bind(COPY_NS)
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'turn-alert',
          order: 46,
          // The label is a thunk, so it re-resolves after a language switch.
          label: () => t('sectionTitle'),
          inject: () => ({ form, t }),
        }, TurnAlertPage)))
      },
    }
  },
})
