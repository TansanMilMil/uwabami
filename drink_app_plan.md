# お酒記録アプリ 実装プラン

## 1. アプリケーション概要
自分が呑んだお酒やこれから呑みたいお酒を記録・管理できるマルチユーザー向けのWebアプリ。お酒の閲覧はログイン不要で誰でも可能だが、データの追加・編集・削除はデータを作成したユーザー（作成者）しかできない仕様とする。
インフラ・使用技術は既存プロジェクト「nina-njaa」の構成をベースにする。

## 2. 技術スタック・インフラ構成
- **フロントエンド**: React 19, TypeScript 7, Vite 8, Tailwind CSS 4, Radix UI, React Router v8
- **バックエンド**: Python 3.14, FastAPI, SQLite
- **インフラ/ホスティング**: Docker Compose (frontend, backend, nginx), NGINX (リバースプロキシ + 静的ファイル配信), マルチユーザー用JWT認証

## 3. データベース設計 (SQLite)

### `users` テーブル (ユーザー管理)
| カラム名 | 型 | 説明 |
|---|---|---|
| `id` | INTEGER/UUID | 主キー |
| `username` | TEXT | ユーザー名 (UNIQUE) |
| `password_hash` | TEXT | ハッシュ化されたパスワード |

### `drinks` テーブル (お酒マスタ)
| カラム名 | 型 | 説明 |
|---|---|---|
| `id` | INTEGER/UUID | 主キー |
| `name` | TEXT | お酒の名前 |
| `category` | TEXT | 種類（日本酒、ワイン、ビールなど） |
| `status` | TEXT | `want_to_drink` または `drunk` |
| `origin` | TEXT | 産地 (任意) |
| `price` | INTEGER | 値段 (任意) |
| `memo` | TEXT | お酒自体に関する共通メモ (任意) |
| `created_by` | INTEGER/UUID | `users.id` への外部キー (作成者) |

### `taste_types` テーブル (味のタイプマスタ)
※ ユーザーが選択肢から選べるようにし、新しいものを追加可能にする
| カラム名 | 型 | 説明 |
|---|---|---|
| `id` | INTEGER/UUID | 主キー |
| `name` | TEXT | 味のタイプ名 (例: 甘口、辛口、フルーティなど) (UNIQUE) |

### `drink_taste_types` テーブル (お酒と味の中間テーブル)
| カラム名 | 型 | 説明 |
|---|---|---|
| `drink_id` | INTEGER/UUID | `drinks.id` への外部キー |
| `taste_type_id` | INTEGER/UUID | `taste_types.id` への外部キー |

### `drink_logs` テーブル (呑んだ履歴)
※ 同じお酒を複数回呑んだ履歴を管理
| カラム名 | 型 | 説明 |
|---|---|---|
| `id` | INTEGER/UUID | 主キー |
| `drink_id` | INTEGER/UUID | `drinks.id` への外部キー |
| `user_id` | INTEGER/UUID | `users.id` への外部キー (作成者) |
| `drunk_date` | DATE | 呑んだ日付 |
| `star_rating` | REAL | 星評価 (1〜5) |
| `memo` | TEXT | その時の感想メモ |

## 4. 画面構成 (フロントエンド)

1. **一覧画面 (Top Page)**
   - **タブ**: 「呑んだ」「呑みたい」の切り替え
   - **リスト表示**: お酒のカード一覧（名前、種類、産地、味のタイプタグなどを表示）
   - **検索/絞り込み**: 名前検索、種類・味のタイプによるフィルタリング、評価順ソートなど
   - **アクション**: 新規お酒の登録ボタン (※ログインユーザーのみ表示)

2. **お酒詳細画面**
   - **基本情報**: 名前、種類、産地、値段、味のタイプタグ（※自分が作成者の場合のみ編集可能）
   - **履歴一覧**: これまでに呑んだ記録（日付、星評価、メモ）を一覧表示
   - **アクション** (※自分が作成者の場合のみ表示):
     - 「呑んだ記録を追加する」ボタン（※「呑みたい」ステータスの場合は、記録追加と同時に「呑んだ」ステータスへ自動更新）
     - お酒の基本情報の編集・削除

3. **登録・編集モーダル / 画面**
   - **お酒の登録**: 名前、種類、ステータス、産地、値段、味のタイプ（既存から選択 or 新規入力して追加）
   - **呑んだ記録の登録**: 日付（デフォルトは今日）、星評価（1〜5）、感想メモ

## 5. APIエンドポイント (FastAPI)

### Auth
- `POST /api/auth/register`: 新規ユーザー登録
- `POST /api/auth/login`: ログイン (JWT発行)
- `POST /api/auth/logout`: ログアウト
- `GET /api/auth/me`: 認証確認

### Drinks
- `GET /api/drinks`: お酒一覧取得 (検索・フィルタリング、未ログイン可)
- `POST /api/drinks`: 新規お酒登録 (ログイン必須)
- `GET /api/drinks/{id}`: お酒詳細取得 (未ログイン可)
- `PUT /api/drinks/{id}`: お酒情報更新 (作成者のみ)
- `DELETE /api/drinks/{id}`: お酒削除 (作成者のみ)

### Drink Logs
- `GET /api/drinks/{id}/logs`: 特定のお酒の履歴取得 (未ログイン可)
- `POST /api/drinks/{id}/logs`: 呑んだ記録を追加 (作成者のみ)
- `PUT /api/logs/{log_id}`: 履歴の更新 (作成者のみ)
- `DELETE /api/logs/{log_id}`: 履歴の削除 (作成者のみ)

### Taste Types
- `GET /api/taste-types`: 味のタイプ一覧取得（サジェスト用）
- `POST /api/taste-types`: 新しい味のタイプを追加

## 6. 開発ステップ (今後の実装フロー)

1. **プロジェクト雛形の用意**: nina-njaaベースの構成 (Docker/NGINX/FastAPI/React) をセットアップ
2. **バックエンド実装**: SQLiteのテーブル設計、CRUD処理のリポジトリ層実装、FastAPIルーティングの実装
3. **フロントエンド実装 (UI基盤)**: Tailwind + Radix UI で共通コンポーネント (ボタン、入力フォーム、モーダル等) の作成
4. **フロントエンド実装 (画面)**: API連携を含めた一覧画面、詳細画面、登録モーダルの作成
5. **テスト・動作確認**: ローカルでの一連の動作確認
