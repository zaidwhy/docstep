# Docstep

Docstep is a VS Code extension that generates Python docstrings from a function or class signature, in Google, NumPy, Sphinx, PEP 257, docBlockr, doxygen or a custom mustache template. It is a maintained fork of [autoDocstring](https://github.com/NilsJPWerner/autoDocstring) by Nils Werner, whose last release was 0.6.1 in February 2022. On top of upstream it fixes docstrings indented to the editor tab size instead of the function body ([#315](https://github.com/NilsJPWerner/autoDocstring/issues/315)), the ignored `generateDocstringOnEnter` setting ([#312](https://github.com/NilsJPWerner/autoDocstring/issues/312)), CRLF templates, and functions and classes with PEP 695 type parameters. The full list is in the [CHANGELOG](CHANGELOG.md).

![Generating a docstring](images/demo.gif)

## Install

Docstep is not on the VS Code Marketplace or Open VSX yet. Build and install it from source:

```bash
git clone https://github.com/zaidwhy/docstep.git
cd docstep
npm install
npx @vscode/vsce package
code --install-extension docstep-1.0.0-dev.vsix
```

If autoDocstring is also installed, disable or uninstall it: both extensions bind `ctrl+shift+2` and both offer a docstring on enter.

## Switching from autoDocstring

Settings moved from `autoDocstring.*` to `docstep.*`. You do not have to change anything: when a `docstep.*` setting is not set in user, workspace or folder settings, Docstep reads your `autoDocstring.*` value instead. Once you set the `docstep.*` key, it wins. To migrate for good, rename the keys in your `settings.json`.

The command is now `docstep.generateDocstring`. A custom keybinding on `autoDocstring.generateDocstring` needs to be pointed at the new command.

## Docstring Formats

To turn off type generation in docstrings use the `-notypes` template of the desired format. The docBlockr format is a typed version of PEP0257.

-   [docBlockr](docs/docblockr.md)
-   [doxygen](docs/doxygen.md)
-   [google](docs/google.md)
-   [numpy](docs/numpy.md)
-   [one-line-sphinx](docs/one-line-sphinx.md)
-   [pep257](docs/pep257.md)
-   [sphinx](docs/sphinx.md)

## Usage

Cursor must be on the line directly below the definition to generate full auto-populated docstring

-   Press enter after opening docstring with triple quotes (configurable `"""` or `'''`)
-   Keyboard shortcut: `ctrl+shift+2` or `cmd+shift+2` for mac
    -   Can be changed in Preferences -> Keyboard Shortcuts -> `docstep.generateDocstring`
-   Command: `Generate Docstring`
-   Right click menu: `Generate Docstring`

## Extension Settings

-   `docstep.docstringFormat`: Switch between different docstring formats
-   `docstep.customTemplatePath`: Path to a custom docstring template (absolute or relative to the project root)
-   `docstep.generateDocstringOnEnter`: Generate the docstring on pressing enter after opening docstring
-   `docstep.includeExtendedSummary`: Include extended summary section in docstring
-   `docstep.includeName`: Include function name at the start of docstring
-   `docstep.startOnNewLine`: New line before summary placeholder
-   `docstep.guessTypes`: Infer types from type hints, default values and variable names
-   `docstep.quoteStyle`: The style of quotes for docstrings
-   `docstep.logLevel`: Output log level (`None`, `Info`, `Debug`)

## Custom Docstring Templates

This extension now supports custom templates. The extension uses the [mustache.js](https://github.com/janl/mustache.js/) templating engine. To use a custom template create a .mustache file and specify its path using the `customTemplatePath` configuration. View the included google docstring [template](src/docstring/templates/google.mustache) for a usage example. The following tags are available for use in custom templates.

### Variables

```
{{name}}                        - name of the function
{{summaryPlaceholder}}          - _summary_ placeholder
{{extendedSummaryPlaceholder}}  - [extended_summary] placeholder
```

### Sections

```
{{#args}}                       - iterate over function arguments
    {{var}}                     - variable name
    {{typePlaceholder}}         - _type_ or guessed type  placeholder
    {{descriptionPlaceholder}}  - _description_ placeholder
{{/args}}

{{#kwargs}}                     - iterate over function kwargs
    {{var}}                     - variable name
    {{typePlaceholder}}         - _type_ or guessed type placeholder
    {{&default}}                - default value (& unescapes the variable)
    {{descriptionPlaceholder}}  - _description_ placeholder
{{/kwargs}}

{{#exceptions}}                 - iterate over exceptions
    {{type}}                    - exception type
    {{descriptionPlaceholder}}  - _description_ placeholder
{{/exceptions}}

{{#yields}}                     - iterate over yields
    {{typePlaceholder}}         - _type_ placeholder
    {{descriptionPlaceholder}}  - _description_ placeholder
{{/yields}}

{{#returns}}                    - iterate over returns
    {{typePlaceholder}}         - _type_ placeholder
    {{descriptionPlaceholder}}  - _description_ placeholder
{{/returns}}
```

### Additional Sections

```
{{#argsExist}}          - display contents if args exist
{{/argsExist}}

{{#kwargsExist}}        - display contents if kwargs exist
{{/kwargsExist}}

{{#parametersExist}}    - display contents if args or kwargs exist
{{/parametersExist}}

{{#exceptionsExist}}    - display contents if exceptions exist
{{/exceptionsExist}}

{{#yieldsExist}}        - display contents if returns exist
{{/yieldsExist}}

{{#returnsExist}}       - display contents if returns exist
{{/returnsExist}}

{{#placeholder}}        - makes contents a placeholder
{{/placeholder}}
```

## Development

```bash
npm install
npm run compile
npm run unit_test
```

## Reporting issues

Report Docstep issues on the [issues page](https://github.com/zaidwhy/docstep/issues). Please do not report Docstep bugs to the autoDocstring tracker.

## Credits

Docstep is built on [autoDocstring](https://github.com/NilsJPWerner/autoDocstring), written by [Nils Werner](https://github.com/NilsJPWerner) and its contributors. The parser, the templates, the docs and the demo are theirs. Fixes taken from open upstream pull requests keep their authors as co-authors on the commit and are credited in the [CHANGELOG](CHANGELOG.md). If Docstep is useful to you, consider [sponsoring Nils](https://github.com/sponsors/NilsJPWerner).

## License

MIT, see [LICENSE](LICENSE). The original copyright notice by Nils Werner is kept.
