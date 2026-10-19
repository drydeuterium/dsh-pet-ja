# dsh-pet-ja 🐾🇯🇵

[DSH (DeepSeek Harness)](https://github.com/deepseek-ai/deepseek-harness) のデスクトップペットプラグイン
**[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** を日本語化するローカルパッチ。

中国語のままだったメニュー・設定ページ・吹き出しの文言を日本語にし、フォントを日本語向けの
**にくまるフォント**に差し替える。アップストリームに日本語ロケールが入るまでのつなぎ。

```
$ node apply.mjs
=== profile "desktop": C:\Users\you\.dsh\profiles\desktop\node_modules\dsh-pet
dsh-pet 0.3.7
  font: assets/fonts/Nikumaru.ttf を配置
  client.js: menu: PET_JA_ANIM / PET_JA_CATEGORY を挿入
  client.js: locale: ja 辞書 + addLanguage を追加
  ...
完了: 5 ファイルを更新
反映: ブラウザ半側はページ再読み込み／ホスト半側はプロファイル再構成か DSH 再起動
```

---

## 何が日本語になるか

| 対象 | 内容 |
| --- | --- |
| 右クリックメニュー | 「动作」→「アクション」、「碎碎念」→「ひとりごと」、「对话」→「おしゃべり」、「回到初始位置」→「初期位置に戻る」、分類（待機 / 方向転換 / ドラッグ / クリック反応 / 移動 / 小ワザ / 遊び / 食べもの / 季節行事 / 文字もの / 残高 / 作業ステータス） |
| アニメ名 **106 種** | メニューに出る表示名だけ日本語（`吃白饭` → 白ごはんを食べる、`原地专心玩魔方` → その場でルービックキューブ 等）。素材ファイル名は中国語のまま触らないので再生は壊れない |
| 設定ページ | 「ペット設定」ページ全体（130 キーの ja 辞書を DSH の locale サービスへ言語パックとして登録。設定 → General → Language に「日本語」が出る） |
| 通知・残高バブル・チャット窓 | 会話完了 / 生成失敗 / 出力が打ち切られました / 残高照会に失敗しました など |
| DSH コマンド | `/pet` `/chat` `/balance` の説明文と結果メッセージ |
| LLM への指示文 | ひとりごとの指示・時刻コンテキスト・曜日（ホスト半側） |
| フォント | 吹き出しとメニューを **にくまるフォント** に（下記「フォントを変える」参照） |
| おまけの修正 | 「desktop 表示のペットがいない」ときにデスクトップ最前面へ赤いエラー帯が出続ける問題を抑制し、その状態ではデスクトップヘルパーを再起動しない |

セリフ本体（ペルソナ・作業ステータスの文言・ミーム画像の説明）は **プラグインのコードではなく設定ファイル** 側なので、
`config/main-config.ja.jsonc` を `~/.dsh/dsh-pet/main-config.jsonc` に置いて日本語化する（`--install-config` でコピー可）。

## 必要なもの

- Windows / macOS / Linux のデスクトップ DSH（`dsh web` でも可）
- Node.js 22 以降（DSH 同梱の Node でも可）
- **dsh-pet 0.3.7**（動作確認済み。他のバージョンでも動くが、文言が変わっていると一部当たらない）
- 動作確認環境: dsh-pet 0.3.7 / DSH 0.2.1-rc.2 / Windows 11

## 使い方

```sh
# 1) 先に dsh-pet を入れておく（未導入なら）
dsh plugin --profile desktop add dsh-pet

# 2) このリポジトリを clone してパッチを当てる
git clone https://github.com/drydeuterium/dsh-pet-ja.git
cd dsh-pet-ja
node apply.mjs                 # dsh-pet が入っている全プロファイルを自動検出して適用
node apply.mjs --dry-run       # 変更内容の確認だけ
node apply.mjs --profile web   # プロファイルを指定する場合

# 3) 日本語のセリフ設定を入れる（任意・既存ファイルは上書きしない）
node apply.mjs --install-config

# 4) 反映
#    ブラウザ半側: DSH のページを再読み込み（F5）
#    ホスト半側  : DSH を再起動（またはプロファイルの再構成）
```

設定ページの言語は「設定 → General → Language」で **日本語** を選ぶ（ブラウザが日本語なら自動選択される）。

### 主なオプション

| オプション | 意味 |
| --- | --- |
| `--profile <name>` | 対象プロファイル（省略時は `~/.dsh/profiles/*/node_modules/dsh-pet` を自動検出） |
| `--pkg <dir>` | プラグインディレクトリを直接指定 |
| `--font <path>` | 使うフォント（既定 `fonts/Nikumaru.ttf`） |
| `--install-config` | 日本語サンプル設定を `~/.dsh/dsh-pet/main-config.jsonc` へコピー（既にあれば何もしない） |
| `--dry-run` | 書き換えずに結果だけ表示 |
| `--verbose` | 「一致しなかった項目」を全件表示 |

## フォントを変える

フォントは **プラグインの `assets/fonts/` に置いて `@font-face` から参照する** 方式。
差し替えたいときは次のどちらか:

```sh
# A) リポジトリのフォントを入れ替えてから適用し直す
cp /path/to/your-font.ttf fonts/Nikumaru.ttf
node apply.mjs

# B) フォントを指定して適用する（プラグイン側には指定したファイル名でコピーされる）
node apply.mjs --font /path/to/your-font.ttf
```

- 拡張子は **.ttf を推奨**（プラグインの `@font-face` は `format("truetype")` を宣言している。
  Chromium は .otf でも大抵読めるが、確実なのは .ttf）
- 日本語グリフを持っていればフォントは何でもよい（例: 源柔ゴシック、M PLUS Rounded 1c、はれのそら明朝 など）
- 一度当てたあとに別名のフォントへ変える場合は、いったんプラグインを入れ直してから再適用するのが確実
  （`dsh plugin --profile desktop remove dsh-pet && dsh plugin --profile desktop add dsh-pet --save-exact`）

同梱している `fonts/Nikumaru.ttf` は **にくまるフォント**（M+ FONTS 派生）。
`fonts/MPLUS-LICENSE_J.txt` / `MPLUS-LICENSE_E.txt` を同梱している（M+ ライセンスは再配布可）。
不要なら `fonts/Nikumaru.ttf` を消して `--font` で自分のフォントを指定すればよい。

## 元に戻す

```sh
dsh plugin --profile desktop remove dsh-pet
dsh plugin --profile desktop add dsh-pet --save-exact   # 入れ直せば素の状態に戻る
```

パッチは `node_modules/dsh-pet` の中身を直接書き換えるので、**プラグインを更新すると元に戻る**。
その場合はこのリポジトリの `apply.mjs` をもう一度実行する（何度実行しても安全）。

## 仕組み

- `data/dict-ja.json` … 設定ページ用の 130 キー日本語辞書。`data/*.json` は置換表
- `data/anim-ja.json` … アニメ 106 種の表示名（素材名は中国語のまま、表示だけ差し替え）
- `data/lit-ja.json` / `data/host-ja.json` … コード直書き文言の置換表（ブラウザ半側 / ホスト半側）
- `apply.mjs` … 上記を当てる。辞書ブロック（zh/en）は温存し、その外側だけ置換する。
  ホスト半側の曜日・時間帯テーブルは字下げやカンマの揺れに強いようブロックごと差し替える

「一致しなかった項目」は既定でファイルごとの件数だけ表示する。多くは「そのファイルには元から無い」だけなので異常ではない。
アップストリームが文言を変えた場合にここが増えるので、`--verbose` で中身を見て置換表を直す。

## 制約・注意

- `node_modules` を直接書き換える。アップストリームの更新で消える（再適用が必要）
- **上流は今のところ他言語対応を考えていない**（[dsh-pet#132](https://github.com/PC2005-cloud/dsh-pet/issues/132) で提案済み → 2026-10-19「DSH 自体が中文/英文のみ」「メニューの動作名はファイル名そのものなので他言語化は簡単ではない」として見送り）。当面はこのパッチが日本語 UI の唯一の手段になる
- 置換は文字列一致なので、プラグインの実装が大きく変わった版では一部当たらないことがある（その場合は issue か PR で知らせてほしい）
- ミーム画像に描かれている中国語の文字自体は画像なのでそのまま（説明文だけ日本語化している）

## 謝辞・ライセンス

- **[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** by PC2005-cloud —— 本パッチの対象。MIT（素材は商用禁止・二創時は原作者の GitHub 明記）
- **にくまるフォント**（`fonts/Nikumaru.ttf`）—— M+ FONTS 派生。`fonts/MPLUS-LICENSE_*.txt` を同梱
- 本リポジトリのスクリプトと翻訳データ: **MIT**（[LICENSE](LICENSE)）

---

# dsh-pet-ja (English)

A local patch that turns the Chinese UI of the DSH desktop-pet plugin
**[dsh-pet](https://github.com/PC2005-cloud/dsh-pet)** into Japanese, and swaps the bubble font for a
Japanese one (Nikumaru font).

**Tested with:** dsh-pet 0.3.7 / DSH 0.2.1-rc.2 / Windows 11.

```sh
dsh plugin --profile desktop add dsh-pet     # install the plugin first
git clone https://github.com/drydeuterium/dsh-pet-ja.git
cd dsh-pet-ja
node apply.mjs                # auto-detects every profile that has dsh-pet installed
node apply.mjs --install-config   # optional: Japanese persona / status texts sample
# reload the DSH page; restart DSH for the host-side strings
```

What gets localized: the right-click menu (including all 106 animation display names — asset filenames stay
untouched), the plugin settings page (a 130-key `ja` dictionary registered as a DSH language pack), system
notifications, balance bubbles, chat window, `/pet` `/chat` `/balance` command descriptions, and the LLM
prompts on the host side. It also suppresses a red error banner the plugin shows on the desktop when no
pet uses desktop display.

Fonts: the patch copies `fonts/Nikumaru.ttf` into the plugin and repoints `@font-face`.
Use your own font with `node apply.mjs --font /path/to/font.ttf` (`.ttf` recommended).

Because the patch edits `node_modules`, **re-run `apply.mjs` after upgrading dsh-pet**.
It is idempotent, and `--dry-run` shows what would change.

Upstream currently has no plans for other languages
(proposed in [dsh-pet#132](https://github.com/PC2005-cloud/dsh-pet/issues/132); answered 2026-10-19 that DSH itself
ships only Chinese/English and that menu action names are file names). Until that changes, this patch is the way
to get a Japanese UI.

License: MIT for the scripts and translation data (see [LICENSE](LICENSE)).
dsh-pet itself is MIT (assets: non-commercial); Nikumaru font is an M+ FONTS derivative distributed under
the M+ license (see `fonts/MPLUS-LICENSE_*.txt`).
