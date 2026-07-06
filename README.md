# 大学用 Discord Bot(時間割・課題リマインダー・学食メニュー)

ポモドーロBotとは別に動く、独立したDiscordボットです。時間割と課題締切の管理・自動通知、学食メニューの表示・自動通知を行います。

すべての通知は「そのコマンドを実行したチャンネル」にだけ届く仕組みです。通知を受け取りたいチャンネルで `notify start` を実行し、やめたいときはそのチャンネルで `notify stop` を実行してください。

## コマンド

### 時間割
- `/timetable add 曜日 限 内容` — 授業を追加(例: 曜日:月 限:1限 内容:英語)
  - 1限 09:00〜10:40 / 2限 10:50〜12:30 / 3限 13:20〜15:00 / 4限 15:10〜16:50 / 5限 17:00〜18:40
- `/timetable list` — 自分の時間割を全部表示(番号付き)
- `/timetable remove 番号` — `list` の番号を指定して削除
- `/timetable today` — 今日の時間割を表示
- `/timetable notify start [時刻] [キーワード]` — このチャンネルで自分宛ての自動通知を開始
  - 毎日指定した時刻(既定07:00)に今日の時間割を通知
  - 各授業の**開始10分前**に「まもなく始まります」を通知
  - 各授業の**終了10分前**に「まもなく終わります」を通知
  - **キーワード**を指定すると、そのキーワードを含む授業だけに絞り込めます(例: `キーワード:メディアデザイン` で必修科目だけ通知)
- `/timetable notify stop` — 通知をすべて停止

### 課題リマインダー
- `/assignment add 内容 締切日 [締切時刻]` — 課題を追加(例: 内容:レポート 締切日:7/20 締切時刻:23:59。時刻省略で23:59扱い)
- `/assignment list` — 自分の課題を締切順に表示
- `/assignment remove 番号` — `list` の番号を指定して削除
- `/assignment notify start` — このチャンネルで自分宛ての締切リマインダーを開始(締切の**3日前・1日前・当日**に通知)
- `/assignment notify stop` — 通知を停止

### イベント(締切・テスト・発表)
- `/event add 種類 内容 日付 [時刻]` — イベントを追加(例: 種類:締切 内容:研究A 第一締切 日付:7/22。時刻省略で23:59扱い)
- `/event list` — 自分のイベントを日付順に表示
- `/event remove 番号` — `list` の番号を指定して削除
- `/event notify start` — このチャンネルで自分宛ての通知を開始(各イベントの**1週間前**に1回通知。すでに1週間を切っているイベントは次のチェック時にすぐ通知)
- `/event notify stop` — 通知を停止
- 過ぎたイベントは自動で一覧から消えます。

### 学食メニュー(東京造形大学)
- `/menu today` — 今日の学食メニューを表示(メニュー名・価格・カロリー・食塩)
- `/menu notify start` — このチャンネルに、新しい日のメニューが公開されたら自動で投稿(約30分ごとにページをチェック)
- `/menu notify stop` — このチャンネルへの自動通知を停止
- `/menu notify status` — 通知先や最後に投稿したメニューの確認
- 取得元: https://www.zokei.ac.jp/university/cafeteria/

## 常時稼働について

- [run-bot.bat](run-bot.bat) がBot本体を起動し、クラッシュしても5秒後に自動で再起動します。ログは `bot.log` に書き出されます。
- [start-hidden.vbs](start-hidden.vbs) は上記バッチをウィンドウ非表示で起動するスクリプトで、Windowsのスタートアップフォルダにコピー済みです。**PCにログインすると自動でBotが起動します。**
- 手動で起動したいときは `start-hidden.vbs` をダブルクリック(または `npm start`)。
- 停止したいときはタスクマネージャーで `node.exe`(コマンドラインが `index.js` のもの)を終了してください。自動起動自体をやめたい場合は、`Win+R` →「`shell:startup`」→ `discord-university-bot.vbs` を削除します。
- 注意: この方式は**PCが起動している間だけ**動きます。PCを閉じても24時間動かしたい場合は、VPS(月数百円〜)やRaspberry Piなどの常時稼働マシンに載せる必要があります。希望があれば別途相談してください。

## 今後追加予定

- Google Classroomの通知(お知らせ・課題)をこのDiscordに転送する機能は、Google側のOAuth認証設定が必要なため別途相談して実装します。

## セットアップ手順

### 1. Discord Developer Portalで新しいボットを作成する

このBotは既存のポモドーロBotとは**別のDiscordアプリケーション**として登録します。

1. https://discord.com/developers/applications を開き、ログイン
2. 右上「New Application」→ 好きな名前(例: University Bot)を付けて作成
3. 左メニュー「Bot」を開き、「Reset Token」→ 表示されたトークンをコピー(これが `DISCORD_TOKEN`。他人に絶対共有しないこと)
4. 「Privileged Gateway Intents」はすべてOFFのままでOK(このBotはスラッシュコマンドのみ使用)
5. 左メニュー「OAuth2」→「URL Generator」を開く
   - SCOPES: `bot` と `applications.commands` にチェック
   - BOT PERMISSIONS: `Send Messages`, `Embed Links` にチェック
   - 一番下に生成されたURLをコピーしてブラウザで開き、サーバーに招待する
6. 「General Information」ページの `Application ID` をコピー(これが `CLIENT_ID`)
7. (任意・推奨)Discordアプリで「設定 → 詳細設定 → 開発者モード」をONにし、対象サーバーを右クリック→「サーバーIDをコピー」(これが `GUILD_ID`。指定するとコマンドが即時反映されます)

### 2. 環境変数を設定する

`.env.example` を `.env` にコピーし、取得した値を入力してください。

```
DISCORD_TOKEN=コピーしたボットトークン
CLIENT_ID=コピーしたApplication ID
GUILD_ID=コピーしたサーバーID(省略可)
```

### 3. 依存パッケージのインストール(済み)

```
npm install
```

### 4. スラッシュコマンドを登録する

```
npm run deploy
```

### 5. Botを起動する

```
npm start
```

コンソールに `〇〇 としてログインしました` と表示されれば起動成功です。

## 注意

- 時間割・課題・通知設定は `data/` フォルダ内のJSONファイルに保存され、Bot再起動後も引き継がれます。
