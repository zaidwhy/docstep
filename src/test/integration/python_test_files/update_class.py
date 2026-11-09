@register
class Shop(Base):
    """A shop.

    Args:
        name (str): Shop name.
        old (int): Gone.
    """

    def __init__(self, name: str, size: int = 3):
        self.name = name
