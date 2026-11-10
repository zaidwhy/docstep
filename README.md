# Docstep

Docstep is a VS Code extension that generates Python docstrings from a function or class signature, in Google, NumPy, Sphinx, PEP 257, docBlockr, doxygen or a custom mustache template. It is a maintained fork of [autoDocstring](https://github.com/NilsJPWerner/autoDocstring) by Nils Werner, whose last release was 0.6.1 in February 2022. On top of upstream it fixes docstrings indented to the editor tab size instead of the function body ([#315](https://github.com/NilsJPWerner/autoDocstring/issues/315)), the ignored `generateDocstringOnEnter` setting ([#312](https://github.com/NilsJPWerner/autoDocstring/issues/312)), class docstrings that listed the base classes as arguments instead of the `__init__` parameters or dataclass fields, indented module docstrings, CRLF templates, and functions and classes with PEP 695 type parameters. It also adds an [Update Docstring](#updating-a-docstring) command that brings an existing docstring in line with a changed signature, the most requested autoDocstring feature. The full list is in the [CHANGELOG](CHANGELOG.md).

![Generating a docstring](images/demo.gif)

## Install

Docstep is not on the VS Code Marketplace or Open VSX yet. Build and install it from source:

```bash
git clone https://github.com/zaidwhy/docstep.git
cd docstep
npm install
npx @vscode/vsce package
code --install-extension docstep-1.0.1.vsix
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

It works in `.py` files and in the code cells of a Jupyter notebook.

## Updating a docstring

When a signature changes, run `Docstep: Update Docstring` from the command palette with the cursor on the `def` line, on one of its decorators, or anywhere inside the function, including its docstring. Docstep rewrites the docstring to match the signature and keeps what you wrote. It only edits when you run the command, never on save or while typing, and the whole change is one edit, so a single undo reverts it. The command has no default keybinding; bind `docstep.updateDocstring` in Preferences -> Keyboard Shortcuts if you want one.

Before, after adding `timeout` and removing `retries`:

```python
def fetch(url: str, timeout: float = 5.0) -> bytes:
    """Download a URL.

    Args:
        retries (int): How often to retry.
        url (str): The address to fetch.

    Examples:
        >>> fetch("https://example.com")
    """
```

After:

```python
def fetch(url: str, timeout: float = 5.0) -> bytes:
    """Download a URL.

    Args:
        url (str): The address to fetch.
        timeout (float, optional): _description_. Defaults to 5.0.

    Returns:
        bytes: _description_

    Examples:
        >>> fetch("https://example.com")
    """
```

It works with the `google`, `numpy` and `sphinx` formats and their `-notypes` variants, read from `docstep.docstringFormat`.

On a class, with the cursor on the `class` line, one of its decorators or inside its docstring, the command matches the class docstring's parameters to the class's own `__init__`, as the Google and NumPy style guides allow. Base classes are never treated as parameters, and what `__init__` returns or raises stays in the `__init__` docstring. With `@overload` stubs, the last `__init__` is the one read. A `@dataclass` (but not `@dataclass(init=False)`) without its own `__init__` is documented from the fields its generated `__init__` takes: `ClassVar` fields, `field(init=False)` and the `KW_ONLY` marker are left out, `InitVar` fields are kept, and a `default_factory` shows as `list()` and so on. Fields inherited from a base dataclass are not seen. With the cursor inside `__init__`, the `__init__` docstring is updated instead. Generate Docstring follows the same rules for a new class docstring.

| What | Rule |
| --- | --- |
| Kept | The description you wrote for every parameter still in the signature, word for word. The summary, extended description, quote style, indentation, line endings and every section Docstep does not model (Examples, Notes, See Also, `.. note::` blocks and so on) stay byte for byte. |
| Added | Parameters new in the signature, with the same `_type_` and `_description_` placeholders Generate Docstring writes. Raises, Returns and Yields sections (or `:raises:`, `:return:` and `:yield:` fields) when Generate Docstring would add them, and a newly raised exception in an existing Raises section. |
| Removed | Parameters no longer in the signature, with their descriptions. A section left empty goes too. Returns, Yields and Raises entries are never removed, because the body scan that finds them can miss a return or raise in a called function. |
| Order | Parameters follow the signature. In sphinx, each `:type:` field moves under its `:param:` field. |
| Types | In the typed formats a parameter's type becomes its annotation, and `, optional` follows whether it has a default. A type you wrote is kept when the signature has no annotation. A single Returns or Yields entry follows the return annotation. The `-notypes` formats never touch types. |
| Defaults | A description that is still the `_description_` placeholder is regenerated, so its default follows the signature. A description you wrote is never edited, so a default you mention in it is not updated. |
| Renames | When exactly one parameter disappeared and exactly one new one took its place (same neighbour before it, neither starred), it is a rename: the entry keeps its description, word for word, under the new name, and in sphinx the `:type:` field follows. Any other change (two renames at once, a parameter that moved) is treated as removed and added, with a placeholder, because a description must never land on an unrelated parameter. Turn `docstep.detectRenames` off to always treat a rename as removed and added. |
| `self`, `cls`, `*args`, `**kwargs` | `self` and `cls` are skipped, as in Generate Docstring. Documented `*args` and `**kwargs` stay, in signature order. Missing ones are added only when `docstep.includeVariadicArgs` is on. |

Docstep makes no edit, and says why, when it cannot read the docstring with confidence:

-   the function has no docstring (run Generate Docstring instead), or the docstring is empty, not closed, single quoted, or followed by code on its line
-   the docstring looks like a different format than `docstep.docstringFormat` (numpy underlines or `:param:` fields under the google setting, for example), or mixes formats
-   an entry it cannot read, such as `a is the first value` under Args, combined numpy entries like `x1, x2 : int`, or a parameter documented twice
-   a section header with text on the same line (`Returns: the value.`), two sections of the same kind, or a Keyword Args or Other Parameters section
-   sphinx fields split into two blocks by text
-   mixed CRLF and LF line endings inside the docstring
-   `docstep.docstringFormat` is not google, numpy or sphinx (the message names it), or `docstep.customTemplatePath` is set
-   the cursor is not on a `def` line, inside a function, or on a class header or class docstring, or the body is on the same line as the `def` or `class`
-   the class has no `__init__` of its own and is not a dataclass, such as a class that inherits its constructor
-   the class's `__init__` has its body on the `def` line
-   the cursor is on a decorator that decorates neither a function nor a class

## Extension Settings

-   `docstep.docstringFormat`: Switch between different docstring formats
-   `docstep.customTemplatePath`: Path to a custom docstring template (absolute or relative to the project root)
-   `docstep.generateDocstringOnEnter`: Generate the docstring on pressing enter after opening docstring
-   `docstep.includeExtendedSummary`: Include extended summary section in docstring
-   `docstep.includeName`: Include function name at the start of docstring
-   `docstep.startOnNewLine`: New line before summary placeholder
-   `docstep.guessTypes`: Infer types from type hints, default values and variable names
-   `docstep.detectRenames`: Update Docstring moves the description of a parameter renamed in place to its new name (on by default)
-   `docstep.includeVariadicArgs`: Document `*args` and `**kwargs` (off by default). Generate Docstring lists `*args` after the positional parameters and `**kwargs` last, in every format, and Update Docstring adds them when they are missing
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
