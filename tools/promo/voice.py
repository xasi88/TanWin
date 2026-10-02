# Озвучка ролика: каждая строка voice.txt → audio/vN.mp3 (нейроголос Microsoft, пакет edge-tts).
#   pip install edge-tts && python tools/promo/voice.py
import asyncio, pathlib, sys
import edge_tts

here = pathlib.Path(__file__).parent
VOICE, RATE = "ru-RU-DmitryNeural", "-4%"

async def main():
    lines = [l.strip() for l in (here / "voice.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
    (here / "audio").mkdir(exist_ok=True)
    for i, text in enumerate(lines, 1):
        out = here / "audio" / f"v{i}.mp3"
        for attempt in range(6):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(out))
                if out.stat().st_size > 2000: break
            except Exception as e:
                print("retry", i, type(e).__name__, e, file=sys.stderr)
            await asyncio.sleep(2 + attempt * 2)
        print(out.name, out.stat().st_size)

asyncio.run(main())
