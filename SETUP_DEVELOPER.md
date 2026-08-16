# 開発者向けセットアップ

このドキュメントは、このリポジトリのコードを書き換えたり、自分でホスティングし直したりする人向け。アプリを普通に使いたいだけの人は [README.md](README.md) を見ればよい（gitは不要）。

## 構成

- `index.html` — フロントエンド（単一ファイル、外部ライブラリなし、ビルド不要）
- `apps-script/Code.gs` — バックエンド（Google Apps Script。スプレッドシートに紐付けて実行する）
- `sample.csv` — 問題データのサンプル
- `README.md` — アプリの使い方（利用者向け、公開用）

各利用者（自分・友達など）は、`Code.gs` を自分のGoogleアカウントに個別デプロイして、それぞれ独立したデータ保存先を持つ想定。フロントエンド（`index.html`）だけが共有コードで、GitHub Pages経由で全員が同じものを見る。

## リポジトリをGitHub Pagesで公開する

1. GitHubに新しいリポジトリを作成（Public。無料プランのPagesはPublic限定）
2. ローカルで以下を実行してpush
   ```
   git init
   git add index.html README.md SETUP_DEVELOPER.md sample.csv apps-script .gitignore
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/kiyokikakene/flashcard_app.git
   git push -u origin main
   ```
3. リポジトリの Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `(root)` に設定して Save
4. 数分待つと `https://kiyokikakene.github.io/flashcard_app/` が公開される

自分自身の動作確認用にデータ保存先（スプレッドシート＋Apps Script）を作る手順は、[README.md](README.md) の「セットアップ」を参照（利用者向け手順とまったく同じ）。

## フロントエンドを更新するとき

`index.html` を編集したら、いつも通り add → commit → push すればGitHub Pagesに自動反映される。バックエンドとの通信仕様（`api.get` / `api.post` が呼ぶ `action` の種類とpayloadの形）を変えない限り、既存のデッキ登録者はそのまま使い続けられる。

```
git add index.html
git commit -m "変更内容"
git push
```

## バックエンド（Code.gs）を更新するとき — 重要な制約

`apps-script/Code.gs` はリポジトリにpushするだけでは**利用者側には反映されない**。Apps Scriptは各利用者が自分のGoogleアカウントに個別デプロイしている独立したコピーなので、通信仕様に関わる変更（新しいaction追加、payloadの形式変更など）をしたときは、**各利用者が自分でコードを貼り替えて再デプロイする必要がある**。

変更のたびに [CHANGELOG.md](CHANGELOG.md) に「影響: フロントのみ / 要Code.gs更新 / 要シート更新」を書いておくと、友達など他の利用者に何を伝えればいいか一目で分かる（自分の備忘録にもなる）。

自分の分を更新する手順:
1. 対象スプレッドシートの Apps Script 編集画面を開く
2. 新しい `Code.gs` の内容に貼り替えて保存
3. 「デプロイ」→「デプロイを管理」→ 既存デプロイの鉛筆アイコン →「バージョン: 新バージョン」を選んで「デプロイ」
   （既存のURLは変わらないので、アプリ側の設定を変更する必要はない）

友達など他の利用者がいる場合は、この手順と新しい `Code.gs` の内容（またはリポジトリの [raw リンク](https://raw.githubusercontent.com/kiyokikakene/flashcard_app/main/apps-script/Code.gs)）を伝える必要がある。

## 過去の破壊的変更・移行メモ

### type列の廃止（単語帳モードと問題モードを同一プール化）

初期バージョンでは問題ごとに `type`（単語/問題）で使えるモードを固定していたが、同じ問題プールを両モードで使えるように変更した。

移行手順:
1. スプレッドシートの `Questions` シートのタブを右クリック →「削除」（次回アクセス時に新しい列構成で自動再作成される。本番データが入っている場合は `type` 列だけを手動で削除してもよい）
2. `Code.gs` を最新内容に貼り替えて保存 → 新バージョンでデプロイ
3. CSVを入れ直す場合は列に `type` を含まない新しい `sample.csv` を使う

### マークのトグル化

マーク機能を「クリックのたびに記録が増えるログ方式」から「オン/オフを切り替えるトグル方式」に変更した。

移行時、旧方式で溜まった `Marks` シートの重複行が残っていると、1回のクリックで消えきらずオンのまま見えることがある。気になる場合は `Marks` シートの中身（ヘッダー行以外）を一度全部削除するとクリーンな状態になる。

## 動作確認

ブラウザに読み込む前に、埋め込みJSの構文だけは手元で軽くチェックできる。

```
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
fs.writeFileSync('_extracted.js', m[1]);
"
node --check "_extracted.js" && echo "JS syntax OK"
rm -f _extracted.js
```

`Code.gs` はApps Scriptの実行環境固有のグローバル（`SpreadsheetApp` 等）に依存するため、ローカルでの実行確認はできない。実際にデプロイして動作を見る必要がある。
