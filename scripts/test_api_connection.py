import asyncio
import sys
import httpx
from app.main import app
from app.core.config import settings
from scripts.test_support import install_test_session


async def main():
    print(f"[*] Testing FastAPI application against {settings.DATABASE_URL}...")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Test /health
        print("\n--- Testing GET /health ---")
        res = await client.get("/health")
        print("Status code:", res.status_code)
        print("Response:", res.json())
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert res.json()["database_connected"] is True, "Database should be connected"
        assert res.json()["redis_connected"] is True, "Redis should be connected"
        assert res.json()["status"] == "ok", "Overall status should be ok"
        print("[+] /health is OK!")

        anon = await client.get("/api/v1/assets/")
        assert anon.status_code == 401, f"Sin sesión debía responder 401, obtuvo {anon.status_code}"
        print("[+] GET /api/v1/assets/ sin sesión -> 401")
        install_test_session()

        # 2. Test GET /api/v1/assets/
        print("\n--- Testing GET /api/v1/assets/ ---")
        res = await client.get("/api/v1/assets/")
        print("Status code:", res.status_code)
        assets = res.json()
        print(f"Total assets fetched: {len(assets)}")
        for a in assets[:5]:
            print(f"  - [{a['asset_type']}] {a['symbol']}: {a['name']}")
        assert len(assets) >= 14, f"Expected at least 14 assets, got {len(assets)}"
        print("[+] /api/v1/assets/ is OK!")

        # 3. Test GET /api/v1/assets/{symbol}
        print("\n--- Testing GET /api/v1/assets/BTC/USDT ---")
        res = await client.get("/api/v1/assets/BTC/USDT")
        print("Status code:", res.status_code)
        print("Asset detail:", res.json())
        assert res.status_code == 200
        assert res.json()["symbol"] == "BTC/USDT"
        print("[+] /api/v1/assets/BTC/USDT is OK!")

    print("\n[SUCCESS] All FastAPI base endpoints and database/redis integrations passed cleanly!")


if __name__ == "__main__":
    asyncio.run(main())
