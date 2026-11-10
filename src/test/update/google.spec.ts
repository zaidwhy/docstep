import * as chai from "chai";
import "mocha";

import { py, run, updated } from "./helpers";

chai.config.truncateThreshold = 0;
const expect = chai.expect;

describe("updateDocstring() google", () => {
    it("should add a new parameter with the generator placeholders", () => {
        const source = py(
            "def add(a: int, b: int) -> int:",
            '    """Add two numbers.',
            "",
            "    Args:",
            "        a (int): The first number.",
            "",
            "    Returns:",
            "        int: The sum.",
            '    """',
            "    return a + b",
        );

        expect(updated("google", source)).to.equal(
            py(
                "def add(a: int, b: int) -> int:",
                '    """Add two numbers.',
                "",
                "    Args:",
                "        a (int): The first number.",
                "        b (int): _description_",
                "",
                "    Returns:",
                "        int: The sum.",
                '    """',
                "    return a + b",
            ),
        );
    });

    it("should remove a parameter that left the signature, with its written description", () => {
        const source = py(
            "def scale(value: float):",
            '    """Scale a value.',
            "",
            "    Args:",
            "        value (float): The value to scale.",
            "        factor (float): How much to scale by.",
            "            Must be positive.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def scale(value: float):",
                '    """Scale a value.',
                "",
                "    Args:",
                "        value (float): The value to scale.",
                '    """',
            ),
        );
    });

    it("should treat a renamed parameter as removed and added", () => {
        const source = py(
            "def greet(person):",
            '    """Say hello.',
            "",
            "    Args:",
            "        name (str): Who to greet.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def greet(person):",
                '    """Say hello.',
                "",
                "    Args:",
                "        person (_type_): _description_",
                '    """',
            ),
        );
    });

    it("should reorder parameters to signature order", () => {
        const source = py(
            "def move(x, y, z):",
            '    """Move.',
            "",
            "    Args:",
            "        z: Depth.",
            "        x: Across.",
            "            More about x.",
            "        y: Down.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def move(x, y, z):",
                '    """Move.',
                "",
                "    Args:",
                "        x: Across.",
                "            More about x.",
                "        y: Down.",
                "        z: Depth.",
                '    """',
            ),
        );
    });

    it("should update a type from the annotation and keep a written type without one", () => {
        const source = py(
            "def load(path: Path, mode, retries: int = 3) -> bytes:",
            '    """Load a file.',
            "",
            "    Args:",
            "        path (str): Where to read.",
            "        mode (str): Open mode.",
            "        retries (str): How often to retry. Defaults to 3.",
            "",
            "    Returns:",
            "        str: The contents.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def load(path: Path, mode, retries: int = 3) -> bytes:",
                '    """Load a file.',
                "",
                "    Args:",
                "        path (Path): Where to read.",
                "        mode (str): Open mode.",
                "        retries (int, optional): How often to retry. Defaults to 3.",
                "",
                "    Returns:",
                "        bytes: The contents.",
                '    """',
            ),
        );
    });

    it("should refresh a placeholder default and keep a written description as is", () => {
        const source = py(
            "def fetch(url, timeout=30, verbose=True, tries=2):",
            '    """Fetch a URL.',
            "",
            "    Args:",
            "        url (_type_): _description_",
            "        timeout (int, optional): _description_. Defaults to 10.",
            "        verbose (bool, optional): Print progress. Defaults to False.",
            "        tries (int): Attempts.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def fetch(url, timeout=30, verbose=True, tries=2):",
                '    """Fetch a URL.',
                "",
                "    Args:",
                "        url (_type_): _description_",
                "        timeout (int, optional): _description_. Defaults to 30.",
                "        verbose (bool, optional): Print progress. Defaults to False.",
                "        tries (int, optional): Attempts.",
                '    """',
            ),
        );
    });

    it("should drop the optional marker when a parameter loses its default", () => {
        const source = py(
            "def fetch(url, timeout):",
            '    """Fetch a URL.',
            "",
            "    Args:",
            "        url (str): Address.",
            "        timeout (int, optional): Seconds.",
            '    """',
        );

        expect(updated("google", source)).to.contain("        timeout (int): Seconds.");
    });

    it("should keep documented *args and **kwargs in order and never add them", () => {
        const source = py(
            "def call(fn, *args, flag=False, **kwargs):",
            '    """Call fn.',
            "",
            "    Args:",
            "        **kwargs: Passed on.",
            "        fn (callable): The function.",
            "        *args: Positional values.",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def call(fn, *args, flag=False, **kwargs):",
                '    """Call fn.',
                "",
                "    Args:",
                "        fn (callable): The function.",
                "        *args: Positional values.",
                "        flag (bool, optional): _description_. Defaults to False.",
                "        **kwargs: Passed on.",
                '    """',
            ),
        );
    });

    it("should skip self in a method inside a class and keep its indentation", () => {
        const source = py(
            "class Shop:",
            "    def buy(self, item: str, count: int = 1):",
            '        """Buy something.',
            "",
            "        Args:",
            "            item (str): What to buy.",
            '        """',
            "        pass",
        );

        expect(updated("google", source, 7)).to.equal(
            py(
                "class Shop:",
                "    def buy(self, item: str, count: int = 1):",
                '        """Buy something.',
                "",
                "        Args:",
                "            item (str): What to buy.",
                "            count (int, optional): _description_. Defaults to 1.",
                '        """',
                "        pass",
            ),
        );
    });

    it("should skip cls and handle async def", () => {
        const source = py(
            "class Client:",
            "    @classmethod",
            "    async def connect(cls, host):",
            '        """Connect."""',
            "        return await open(host)",
        );

        expect(updated("google", source, 2)).to.equal(
            py(
                "class Client:",
                "    @classmethod",
                "    async def connect(cls, host):",
                '        """Connect.',
                "",
                "        Args:",
                "            host (_type_): _description_",
                "",
                "        Returns:",
                "            _type_: _description_",
                '        """',
                "        return await open(host)",
            ),
        );
    });

    it("should leave the summary, extended description and other sections byte for byte", () => {
        const source = py(
            "def area(width, height):",
            '    """Area of a rectangle.  ',
            "",
            "    Uses   the usual formula.",
            "      An odd indent stays.",
            "",
            "    Note:",
            "        Units are not checked.",
            "",
            "    Args:",
            "        width: Width.",
            "",
            "    Examples:",
            "        >>> area(2, 3)",
            "        6",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def area(width, height):",
                '    """Area of a rectangle.  ',
                "",
                "    Uses   the usual formula.",
                "      An odd indent stays.",
                "",
                "    Note:",
                "        Units are not checked.",
                "",
                "    Args:",
                "        width: Width.",
                "        height (_type_): _description_",
                "",
                "    Examples:",
                "        >>> area(2, 3)",
                "        6",
                '    """',
            ),
        );
    });

    it("should add Yields then Raises, the order of Google's style guide", () => {
        const source = py(
            "def numbers(limit: int) -> Iterator[int]:",
            '    """Count up.',
            "",
            "    Args:",
            "        limit (int): Upper bound.",
            '    """',
            "    if limit < 0:",
            "        raise ValueError('negative')",
            "    yield limit",
        );

        expect(updated("google", source)).to.equal(
            py(
                "def numbers(limit: int) -> Iterator[int]:",
                '    """Count up.',
                "",
                "    Args:",
                "        limit (int): Upper bound.",
                "",
                "    Yields:",
                "        Iterator[int]: _description_",
                "",
                "    Raises:",
                "        ValueError: _description_",
                '    """',
                "    if limit < 0:",
                "        raise ValueError('negative')",
                "    yield limit",
            ),
        );
    });

    it("should add a missing exception to an existing Raises section and keep extra ones", () => {
        const source = py(
            "def parse(text):",
            '    """Parse.',
            "",
            "    Args:",
            "        text: Input.",
            "",
            "    Raises:",
            "        errors.ParseError: Bad input.",
            '    """',
            "    if not text:",
            "        raise KeyError(text)",
            "    raise ParseError(text)",
        );

        expect(updated("google", source)).to.equal(
            py(
                "def parse(text):",
                '    """Parse.',
                "",
                "    Args:",
                "        text: Input.",
                "",
                "    Raises:",
                "        errors.ParseError: Bad input.",
                "        KeyError: _description_",
                '    """',
                "    if not text:",
                "        raise KeyError(text)",
                "    raise ParseError(text)",
            ),
        );
    });

    it("should remove the Args section when the last parameter is gone", () => {
        const source = py(
            "def now():",
            '    """Current time.',
            "",
            "    Args:",
            "        tz (str): Zone.",
            "",
            "    Examples:",
            "        >>> now()",
            '    """',
        );

        expect(updated("google", source)).to.equal(
            py(
                "def now():",
                '    """Current time.',
                "",
                "    Examples:",
                "        >>> now()",
                '    """',
            ),
        );
    });

    it("should keep CRLF line endings", () => {
        const source = py(
            "def add(a, b):\r",
            '    """Add.\r',
            "\r",
            "    Args:\r",
            "        b: Second.\r",
            '    """\r',
            "    pass\r",
        );

        expect(updated("google", source)).to.equal(
            py(
                "def add(a, b):\r",
                '    """Add.\r',
                "\r",
                "    Args:\r",
                "        a (_type_): _description_\r",
                "        b: Second.\r",
                '    """\r',
                "    pass\r",
            ),
        );
    });

    it("should keep single quotes and a raw prefix, and start on a new line as written", () => {
        const source = py("def f(a):", "    r'''", "    Summary.", "    '''");

        expect(updated("google", source)).to.equal(
            py(
                "def f(a):",
                "    r'''",
                "    Summary.",
                "",
                "    Args:",
                "        a (_type_): _description_",
                "    '''",
            ),
        );
    });

    it("should work from the def line, the docstring and the body", () => {
        const source = py(
            "def f(a):",
            '    """Summary.',
            "",
            "    Args:",
            "        b: Gone.",
            '    """',
            "    x = 1",
            "    return x",
        );
        const results = [0, 1, 4, 7].map((line) => updated("google", source, line));

        expect(new Set(results).size).to.equal(1);
        expect(results[0]).to.contain("        a (_type_): _description_");
    });

    it("should update the innermost function under the cursor", () => {
        const source = py(
            "def outer(a):",
            '    """Outer."""',
            "    def inner(b):",
            '        """Inner."""',
            "        return b",
            "    return inner",
        );

        expect(updated("google", source, 4)).to.equal(
            py(
                "def outer(a):",
                '    """Outer."""',
                "    def inner(b):",
                '        """Inner.',
                "",
                "        Args:",
                "            b (_type_): _description_",
                "",
                "        Returns:",
                "            _type_: _description_",
                '        """',
                "        return b",
                "    return inner",
            ),
        );
    });

    it("should handle a def header over several lines", () => {
        const source = py(
            "def build(",
            "    name: str,",
            "    size: int = 0,  # comment: with colon",
            ") -> None:",
            '    """Build it.',
            "",
            "    Args:",
            "        name (str): Name.",
            '    """',
        );

        expect(updated("google", source, 1)).to.contain(
            py("        name (str): Name.", "        size (int, optional): _description_. Defaults to 0."),
        );
    });

    it("should report an up to date docstring and make no edit", () => {
        const source = py(
            "def add(a: int, b: int = 1) -> int:",
            '    """Add.',
            "",
            "    Args:",
            "        a (int): First.",
            "        b (int, optional): Second. Defaults to 1.",
            "",
            "    Returns:",
            "        int: Sum.",
            '    """',
            "    return a + b",
        );

        expect(run("google", source)).to.deep.equal({
            kind: "unchanged",
            message: 'The docstring of "add" is already up to date.',
        });
    });

    it("should be idempotent", () => {
        const source = py(
            "def f(a: int, b=2, *args, **kw) -> str:",
            '    """Summary.',
            "",
            "    Args:",
            "        z: Gone.",
            "        **kw: Extra.",
            '    """',
            "    return str(a)",
        );
        const once = updated("google", source);

        expect(run("google", once).kind).to.equal("unchanged");
    });

    it("should only write placeholders without types for google-notypes", () => {
        const source = py(
            "def f(a: int, b: str = 'x') -> int:",
            '    """Summary.',
            "",
            "    Args:",
            "        a (float): First.",
            '    """',
            "    return 1",
        );

        expect(updated("google-notypes", source)).to.equal(
            py(
                "def f(a: int, b: str = 'x') -> int:",
                '    """Summary.',
                "",
                "    Args:",
                "        a (float): First.",
                "        b: _description_. Defaults to 'x'.",
                "",
                "    Returns:",
                "        _description_",
                '    """',
                "    return 1",
            ),
        );
    });

    it("should use _type_ for new entries when guessTypes is off", () => {
        const source = py("def f(a: int):", '    """Summary."""');

        expect(updated("google", source, 0, false)).to.contain("        a (_type_): _description_");
    });

    it("should not read return or raise words inside the docstring as code", () => {
        const source = py(
            "def f(a):",
            '    """Summary.',
            "",
            "    Will return a value or raise ValueError when asked.",
            "",
            "    Args:",
            "        a: First.",
            '    """',
            "    print(a)",
        );

        expect(run("google", source).kind).to.equal("unchanged");
    });
});
