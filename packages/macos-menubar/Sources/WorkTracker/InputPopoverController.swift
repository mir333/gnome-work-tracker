import AppKit

/// A one-line "Label: [text field] [Button]" popover, used for both the
/// "Started at" editor and the note entry (same UI as the GNOME popups).
@MainActor
final class InputPopoverController: NSViewController {
    private let labelText: String
    private let initialText: String
    private let placeholder: String
    private let buttonTitle: String
    private let fieldWidth: CGFloat
    private let onSubmit: (String, InputPopoverController) -> Void

    private let field = NSTextField(string: "") // single-line, scrollable
    private lazy var button = NSButton(title: buttonTitle, target: self, action: #selector(submit))

    /// Disables input while a request is in flight (prevents double submits).
    var isBusy = false {
        didSet {
            field.isEnabled = !isBusy
            button.isEnabled = !isBusy
        }
    }

    init(
        label: String, initialText: String = "", placeholder: String = "", buttonTitle: String,
        fieldWidth: CGFloat, onSubmit: @escaping (String, InputPopoverController) -> Void
    ) {
        self.labelText = label
        self.initialText = initialText
        self.placeholder = placeholder
        self.buttonTitle = buttonTitle
        self.fieldWidth = fieldWidth
        self.onSubmit = onSubmit
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func loadView() {
        let label = NSTextField(labelWithString: labelText)

        field.stringValue = initialText
        field.placeholderString = placeholder
        field.target = self
        field.action = #selector(submit) // Return submits
        (field.cell as? NSTextFieldCell)?.sendsActionOnEndEditing = false
        field.translatesAutoresizingMaskIntoConstraints = false
        field.widthAnchor.constraint(equalToConstant: fieldWidth).isActive = true

        button.bezelStyle = .rounded

        let stack = NSStackView(views: [label, field, button])
        stack.orientation = .horizontal
        stack.alignment = .centerY
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        view = stack
        preferredContentSize = stack.fittingSize
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeKey()
        view.window?.makeFirstResponder(field)
        field.currentEditor()?.selectAll(nil)
    }

    @objc private func submit() {
        guard !isBusy else { return }
        onSubmit(field.stringValue, self)
    }
}
