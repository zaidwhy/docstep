@dataclass
class MyClass:
    """_summary_

    :param para_a: _description_, defaults to 1
    :type para_a: int, optional
    :param para_b: _description_, defaults to None
    :type para_b: str, optional
    :param para_c: _description_, defaults to (1, "a")
    :type para_c: Tuple[int, str], optional
    """
    para_a: int = 1
    para_b: str = None
    para_c: Tuple[int, str] = (1, "a")
