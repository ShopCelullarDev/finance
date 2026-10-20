from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base


class NewsEvent(Base):
    __tablename__ = "news_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    published_at = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    source = Column(String(100), nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=True)
    sentiment_score = Column(Numeric(4, 3), nullable=True)
    affected_assets = Column(ARRAY(String(20)), nullable=True)

    def __repr__(self) -> str:
        return f"<NewsEvent {self.source} sentiment={self.sentiment_score}: {self.title[:30]}...>"
