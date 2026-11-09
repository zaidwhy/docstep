import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() numpy", () => {
    it("should add a new parameter with the generator placeholders", () => {
        const source = py(
            "def add(a: int, b: float = 0.5):",
            '    """Add two numbers.',
            "",
            "    Parameters",
            "    ----------",
            "    a : int",
            "        The first number.",
            '    """',
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def add(a: int, b: float = 0.5):",
                '    """Add two numbers.',
                "",
                "    Parameters",
                "    ----------",
                "    a : int",
                "        The first number.",
                "    b : float, optional",
                "        _description_, by default 0.5",
                '    """',
            ),
        );
    });

    it("should remove a parameter that left the signature, with its written description", () => {
        const source = py(
            "def scale(value):",
            '    """Scale a value.',
            "",
            "    Parameters",
            "    ----------",
            "    factor : float",
            "        How much to scale by.",
            "",
            "        Must be positive.",
            "    value : float",
            "        The value.",
            '    """',
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def scale(value):",
                '    """Scale a value.',
                "",
                "    Parameters",
                "    ----------",
                "    value : float",
                "        The value.",
                '    """',
            ),
        );
    });

    it("should treat a renamed parameter as removed and added", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    Parameters",
            "    ----------",
            "    name : str",
            "        Who to greet.",
            '    """',
        );

        expect(updated("numpy", source)).to.contain(
            py("    ----------", "    person : _type_", "        _description_", '    """'),
        );
    });

    it("should reorder parameters to signature order and keep blank lines between entries", () => {
        const source = py(
            "def move(x, y):",
            '    """Move.',
            "",
            "    Parameters",
            "    ----------",
            "    y : int",
            "        Down.",
            "",
            "    x : int",
            "        Across.",
            '    """',
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def move(x, y):",
                '    """Move.',
                "",
                "    Parameters",
                "    ----------",
                "    x : int",
                "        Across.",
                "",
                "    y : int",
                "        Down.",
                '    """',
            ),
        );
    });

    it("should update types from annotations, keep written types without one, and track optional", () => {
        const source = py(
            "def load(path: Path, mode, retries=3) -> bytes:",
            '    """Load a file.',
            "",
            "    Parameters",
            "    ----------",
            "    path : str",
            "        Where to read.",
            "    mode : {'r', 'rb'}",
            "        Open mode.",
            "    retries : int",
            "        How often, by default 3",
            "",
            "    Returns",
            "    -------",
            "    str",
            "        The contents.",
            '    """',
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def load(path: Path, mode, retries=3) -> bytes:",
                '    """Load a file.',
                "",
                "    Parameters",
                "    ----------",
                "    path : Path",
                "        Where to read.",
                "    mode : {'r', 'rb'}",
                "        Open mode.",
                "    retries : int, optional",
                "        How often, by default 3",
                "",
                "    Returns",
                "    -------",
                "    bytes",
                "        The contents.",
                '    """',
            ),
        );
    });

    it("should refresh a placeholder default and update a named return type", () => {
        const source = py(
            "def fetch(url, timeout=30) -> Response:",
            '    """Fetch a URL.',
            "",
            "    Parameters",
            "    ----------",
            "    url : str",
            "        Address.",
            "    timeout : int, optional",
            "        _description_, by default 10",
            "",
            "    Returns",
            "    -------",
            "    result : dict",
            "        The response.",
            '    """',
        );

        expect(updated("numpy", source)).to.contain(
            py(
                "    timeout : int, optional",
                "        _description_, by default 30",
                "",
                "    Returns",
                "    -------",
                "    result : Response",
                "        The response.",
            ),
        );
    });

    it("should keep documented *args and **kwargs and skip self in a method", () => {
        const source = py(
            "class Runner:",
            "    async def run(self, job, *args, **kwargs):",
            '        """Run a job.',
            "",
            "        Parameters",
            "        ----------",
            "        **kwargs",
            "            Options.",
            "        *args",
            "            Values.",
            "        self : Runner",
            "            Not a parameter to document.",
            '        """',
        );

        expect(updated("numpy", source, 2)).to.equal(
            py(
                "class Runner:",
                "    async def run(self, job, *args, **kwargs):",
                '        """Run a job.',
                "",
                "        Parameters",
                "        ----------",
                "        job : _type_",
                "            _description_",
                "        *args",
                "            Values.",
                "        **kwargs",
                "            Options.",
                '        """',
            ),
        );
    });

    it("should add Returns, Yields and Raises in generator order and leave Notes and Examples alone", () => {
        const source = py(
            "def check(value) -> bool:",
            '    """Check a value.',
            "",
            "    Parameters",
            "    ----------",
            "    value : int",
            "        The value.",
            "",
            "    Notes",
            "    -----",
            "    Uses   :math:`x^2`.",
            "",
            "    Examples",
            "    --------",
            "    >>> check(1)",
            "    True",
            '    """',
            "    if value is None:",
            "        raise TypeError('value')",
            "    return value > 0",
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def check(value) -> bool:",
                '    """Check a value.',
                "",
                "    Parameters",
                "    ----------",
                "    value : int",
                "        The value.",
                "",
                "    Returns",
                "    -------",
                "    bool",
                "        _description_",
                "",
                "    Raises",
                "    ------",
                "    TypeError",
                "        _description_",
                "",
                "    Notes",
                "    -----",
                "    Uses   :math:`x^2`.",
                "",
                "    Examples",
                "    --------",
                "    >>> check(1)",
                "    True",
                '    """',
                "    if value is None:",
                "        raise TypeError('value')",
                "    return value > 0",
            ),
        );
    });

    it("should expand a one line docstring", () => {
        const source = py("def f(a):", '    """Summary."""', "    return a");

        expect(updated("numpy", source)).to.equal(
            py(
                "def f(a):",
                '    """Summary.',
                "",
                "    Parameters",
                "    ----------",
                "    a : _type_",
                "        _description_",
                "",
                "    Returns",
                "    -------",
                "    _type_",
                "        _description_",
                '    """',
                "    return a",
            ),
        );
    });

    it("should remove the Parameters section when no parameter is left", () => {
        const source = py(
            "def now():",
            '    """Current time.',
            "",
            "    Parameters",
            "    ----------",
            "    tz : str",
            "        Zone.",
            '    """',
        );

        expect(updated("numpy", source)).to.equal(py("def now():", '    """Current time.', '    """'));
    });

    it("should keep CRLF line endings", () => {
        const source = py(
            "def add(a, b):\r",
            '    """Add.\r',
            "\r",
            "    Parameters\r",
            "    ----------\r",
            "    b : int\r",
            "        Second.\r",
            '    """\r',
        );

        expect(updated("numpy", source)).to.equal(
            py(
                "def add(a, b):\r",
                '    """Add.\r',
                "\r",
                "    Parameters\r",
                "    ----------\r",
                "    a : _type_\r",
                "        _description_\r",
                "    b : int\r",
                "        Second.\r",
                '    """\r',
            ),
        );
    });

    it("should be idempotent", () => {
        const source = py("def f(a: int, b=2) -> str:", '    """Summary."""', "    return str(a)");
        const once = updated("numpy", source);

        expect(run("numpy", once).kind).to.equal("unchanged");
    });

    it("should follow the numpy-notypes template", () => {
        const source = py(
            "def f(a: int, b=1) -> int:",
            '    """Summary.',
            "",
            "    Parameters",
            "    ----------",
            "    a : float",
            "        First.",
            '    """',
            "    return a",
        );

        expect(updated("numpy-notypes", source)).to.equal(
            py(
                "def f(a: int, b=1) -> int:",
                '    """Summary.',
                "",
                "    Parameters",
                "    ----------",
                "    a : float",
                "        First.",
                "    b, optional",
                "        _description_, by default 1",
                "",
                "    Returns",
                "    -------",
                "        _description_",
                '    """',
                "    return a",
            ),
        );
    });
});
