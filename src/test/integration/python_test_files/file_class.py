class Shop(Base):

    def __init__(self, name: str, size: int = 3):
        if size < 0:
            raise ValueError(size)
        self.name = name
