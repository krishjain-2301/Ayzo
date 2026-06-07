import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import sys

async def main():
    engine = create_async_engine('sqlite+aiosqlite:///ayzo_demo.db')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with async_session() as session:
            result = await session.execute(text('SELECT id, email FROM users'))
            users = result.fetchall()
            print("Users:")
            for u in users:
                print(f"  {u.email} -> {repr(u.id)} (type: {type(u.id)})")
                
            result = await session.execute(text('SELECT id, user_id FROM campaigns LIMIT 2'))
            camps = result.fetchall()
            print("Campaigns:")
            for c in camps:
                print(f"  Campaign ID: {c.id}, user_id: {repr(c.user_id)}")
    except Exception as e:
        print("DB ERROR:", e)

if __name__ == '__main__':
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
