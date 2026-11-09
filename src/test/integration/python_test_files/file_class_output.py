class Shop(Base):
    """_summary_

    :param name: _description_
    :type name: str
    :param size: _description_, defaults to 3
    :type size: int, optional
    """
    def __init__(self, name: str, size: int = 3):
        if size < 0:
            raise ValueError(size)
        self.name = name
