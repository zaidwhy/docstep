import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() sphinx", () => {
    it("should add a new parameter with the generator placeholders", () => {
        const source = py(
            "def add(a: int, b: float = 0.5):",
            '    """Add two numbers.',
            "",
            "    :param a: The first number.",
            "    :type a: int",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def add(a: int, b: float = 0.5):",
                '    """Add two numbers.',
                "",
                "    :param a: The first number.",
                "    :type a: int",
                "    :param b: _description_, defaults to 0.5",
                "    :type b: float, optional",
                '    """',
            ),
        );
    });

    it("should remove a parameter and its :type: field", () => {
        const source = py(
            "def scale(value):",
            '    """Scale a value.',
            "",
            "    :param value: The value.",
            "    :param factor: How much to scale by,",
            "        must be positive.",
            "    :type factor: float",
            "    :return: The result.",
            '    """',
            "    return value",
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def scale(value):",
                '    """Scale a value.',
                "",
                "    :param value: The value.",
                "    :return: The result.",
                '    """',
                "    return value",
            ),
        );
    });

    it("should treat a renamed parameter as removed and added", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    :param name: Who to greet.",
            "    :type name: str",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def greet(person):",
                '    """Say hello.',
                "",
                "    :param person: _description_",
                "    :type person: _type_",
                '    """',
            ),
        );
    });

    it("should reorder parameters and move each :type: under its :param:", () => {
        const source = py(
            "def move(x, y):",
            '    """Move.',
            "",
            "    :param y: Down.",
            "    :param x: Across.",
            "    :type y: int",
            "    :type x: int",
            "    :raises ValueError: Off the board.",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def move(x, y):",
                '    """Move.',
                "",
                "    :param x: Across.",
                "    :type x: int",
                "    :param y: Down.",
                "    :type y: int",
                "    :raises ValueError: Off the board.",
                '    """',
            ),
        );
    });

    it("should update types and the return type from annotations", () => {
        const source = py(
            "def load(path: Path, mode, retries: int = 3, *, inline: bool) -> bytes:",
            '    """Load a file.',
            "",
            "    :param path: Where to read.",
            "    :type path: str",
            "    :param mode: Open mode.",
            "    :type mode: str",
            "    :param retries: How often.",
            "    :param str inline: Inline type.",
            "    :return: The contents.",
            "    :rtype: str",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def load(path: Path, mode, retries: int = 3, *, inline: bool) -> bytes:",
                '    """Load a file.',
                "",
                "    :param path: Where to read.",
                "    :type path: Path",
                "    :param mode: Open mode.",
                "    :type mode: str",
                "    :param retries: How often.",
                "    :type retries: int, optional",
                "    :param bool inline: Inline type.",
                "    :return: The contents.",
                "    :rtype: bytes",
                '    """',
            ),
        );
    });

    it("should refresh a placeholder default and keep a written one", () => {
        const source = py(
            "def fetch(url, timeout=30, verbose=True):",
            '    """Fetch a URL.',
            "",
            "    :param url: Address.",
            "    :param timeout: _description_, defaults to 10",
            "    :type timeout: int, optional",
            "    :param verbose: Print progress, defaults to False",
            "    :type verbose: bool",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def fetch(url, timeout=30, verbose=True):",
                '    """Fetch a URL.',
                "",
                "    :param url: Address.",
                "    :param timeout: _description_, defaults to 30",
                "    :type timeout: int, optional",
                "    :param verbose: Print progress, defaults to False",
                "    :type verbose: bool, optional",
                '    """',
            ),
        );
    });

    it("should keep documented *args and **kwargs and skip cls", () => {
        const source = py(
            "class Factory:",
            "    @classmethod",
            "    async def make(cls, kind, *args, **kwargs):",
            '        """Make one.',
            "",
            "        :param kwargs: Options.",
            "        :param kind: What to make.",
            "        :param args: Values.",
            "        :param cls: The class.",
            '        """',
        );

        expect(updated("sphinx", source, 3)).to.equal(
            py(
                "class Factory:",
                "    @classmethod",
                "    async def make(cls, kind, *args, **kwargs):",
                '        """Make one.',
                "",
                "        :param kind: What to make.",
                "        :param args: Values.",
                "        :param kwargs: Options.",
                '        """',
            ),
        );
    });

    it("should add raises, return and yield fields in generator order and keep other text", () => {
        const source = py(
            "def check(value) -> bool:",
            '    """Check a value.',
            "",
            "    .. note:: Uses :math:`x^2`.",
            "",
            "    :param value: The value.",
            "    :meta private:",
            "",
            "    See the guide for more.",
            '    """',
            "    if value is None:",
            "        raise TypeError('value')",
            "    return value > 0",
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def check(value) -> bool:",
                '    """Check a value.',
                "",
                "    .. note:: Uses :math:`x^2`.",
                "",
                "    :param value: The value.",
                "    :meta private:",
                "    :raises TypeError: _description_",
                "    :return: _description_",
                "    :rtype: bool",
                "",
                "    See the guide for more.",
                '    """',
                "    if value is None:",
                "        raise TypeError('value')",
                "    return value > 0",
            ),
        );
    });

    it("should add a field list to a one line docstring", () => {
        const source = py("def f(a):", "    '''Summary.'''", "    yield a");

        expect(updated("sphinx", source)).to.equal(
            py(
                "def f(a):",
                "    '''Summary.",
                "",
                "    :param a: _description_",
                "    :type a: _type_",
                "    :yield: _description_",
                "    :rtype: _type_",
                "    '''",
                "    yield a",
            ),
        );
    });

    it("should remove the field list when no field is left", () => {
        const source = py(
            "def now():",
            '    """Current time.',
            "",
            "    :param tz: Zone.",
            "",
            "    More text.",
            '    """',
        );

        expect(updated("sphinx", source)).to.equal(
            py("def now():", '    """Current time.', "", "    More text.", '    """'),
        );
    });

    it("should keep CRLF line endings", () => {
        const source = py(
            "def add(a, b):\r",
            '    """Add.\r',
            "\r",
            "    :param b: Second.\r",
            '    """\r',
        );

        expect(updated("sphinx", source)).to.equal(
            py(
                "def add(a, b):\r",
                '    """Add.\r',
                "\r",
                "    :param a: _description_\r",
                "    :type a: _type_\r",
                "    :param b: Second.\r",
                '    """\r',
            ),
        );
    });

    it("should be idempotent", () => {
        const source = py("def f(a: int, b=2) -> str:", '    """Summary."""', "    return str(a)");
        const once = updated("sphinx", source);

        expect(run("sphinx", once).kind).to.equal("unchanged");
    });

    it("should follow the sphinx-notypes template and leave written :type: fields alone", () => {
        const source = py(
            "def f(a: int, b=1) -> int:",
            '    """Summary.',
            "",
            "    :param a: First.",
            "    :type a: float",
            '    """',
            "    return a",
        );

        expect(updated("sphinx-notypes", source)).to.equal(
            py(
                "def f(a: int, b=1) -> int:",
                '    """Summary.',
                "",
                "    :param a: First.",
                "    :type a: float",
                "    :param b: _description_, defaults to 1",
                "    :return: _description_",
                '    """',
                "    return a",
            ),
        );
    });
});
