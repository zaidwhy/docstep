@register
class Shop(Base):
    """A shop.

    Args:
        name (str): Shop name.
        size (int, optional): _description_. Defaults to 3.
    """

    def __init__(self, name: str, size: int = 3):
        self.name = name
