import json
import os

from fastapi import HTTPException
from openai import OpenAI

OPENAI_API_KEY = os.environ.get("UWABAMI_OPENAI_API_KEY")
DRINK_SUGGEST_MODEL = os.environ.get("UWABAMI_OPENAI_DRINK_SUGGEST_MODEL", "gpt-4o-mini")

DRINK_SUGGEST_INSTRUCTIONS = (
    "あなたはお酒（日本酒・ワイン・ウイスキー・焼酎・ビール・その他あらゆる酒類）の"
    "商品情報リサーチアシスタントです。\n"
    "ユーザーが入力したお酒の名前について、ウェブ検索ツールを使って実在する商品情報を調査し、"
    "以下のJSON形式のみを出力してください。前置き・説明文・Markdownのコードブロック記法は一切含めないこと。\n\n"
    '{"category": "種類（文字列またはnull）", '
    '"origin": "産地（文字列またはnull）", '
    '"taste_types": ["味の候補リストの中から一致するものだけを文字列でそのまま列挙"], '
    '"memo": "特徴を紹介する100〜150字程度の文章（不明ならnull）", '
    '"price": 想定小売価格の円単位の整数（不明ならnull）}\n\n'
    "重要なルール:\n"
    "- category は与えられた『既存カテゴリ候補』の中に近い表記があれば必ずそれを使う。"
    "無ければ簡潔な新しい種類名（例:「赤ワイン」「シングルモルトウイスキー」）を提案してよい。\n"
    "- origin も同様に『既存産地候補』を優先し、無ければ国名・地域名を提案してよい。\n"
    "- taste_types は必ず『味のタイプ候補』のリストに含まれる文字列のみを、リストにある表記のまま返すこと。"
    "候補にない味の表現は絶対に新しく作らないこと。該当が無ければ空配列にすること。\n"
    "- 検索しても実在が確認できない、または情報が特定できない項目は無理に埋めず null（taste_typesは空配列）にすること。"
    "存在しないお酒名をでっち上げないこと。\n"
    "- price は円単位の整数のみ。範囲表記や通貨記号は含めないこと。"
)


def _build_user_prompt(name, category_candidates, origin_candidates, taste_type_candidates):
    return (
        f"お酒の名前: {name}\n\n"
        f"既存カテゴリ候補: {', '.join(category_candidates) if category_candidates else '(なし)'}\n"
        f"既存産地候補: {', '.join(origin_candidates) if origin_candidates else '(なし)'}\n"
        f"味のタイプ候補（この中からのみ選択可）: "
        f"{', '.join(taste_type_candidates) if taste_type_candidates else '(なし)'}"
    )


def suggest_drink_info(name, category_candidates, origin_candidates, taste_type_candidates):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY が設定されていません")

    client = OpenAI(api_key=OPENAI_API_KEY)
    user_prompt = _build_user_prompt(name, category_candidates, origin_candidates, taste_type_candidates)

    try:
        response = client.responses.create(
            model=DRINK_SUGGEST_MODEL,
            instructions=DRINK_SUGGEST_INSTRUCTIONS,
            input=user_prompt,
            tools=[{"type": "web_search_preview"}],
            timeout=30,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAI APIの呼び出しに失敗しました: {e}")

    content = response.output_text
    if not content:
        raise HTTPException(status_code=500, detail="OpenAIのレスポンスが空でした")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"OpenAIのレスポンス解析に失敗しました: {e}")

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=500, detail="OpenAIのレスポンス形式が不正です")

    return parsed
