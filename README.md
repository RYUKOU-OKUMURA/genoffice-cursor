# [GenOffice](https://genoffice.ai/)

**世界初の、フル機能を備えたオープンソース AI Office スイート。**

[![License: Apache-2.0](https://img.shields.io/github/license/genspark-ai/genoffice)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/genspark-ai/genoffice)](https://github.com/genspark-ai/genoffice/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/genspark-ai/genoffice/total)](https://github.com/genspark-ai/genoffice/releases)
[![GitHub stars](https://img.shields.io/github/stars/genspark-ai/genoffice?style=flat)](https://github.com/genspark-ai/genoffice/stargazers)
![Platforms: macOS | Windows | Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

[Website](https://genoffice.ai/) · [Download](https://github.com/genspark-ai/genoffice/releases/latest) · [Demo](https://www.youtube.com/watch?v=B2pLdMX95v4)

GenOffice は、macOS、Windows、Linux 向けの無料オープンソースの Microsoft
Office 代替です。後付けのチャット欄ではなく、AI 編集を第一級のワークフロー
として組み込んでいます。本物の Microsoft Office 形式 — Word (`.docx`)、
Excel (`.xlsx`)、PowerPoint (`.pptx`) — を開いて保存でき、PDF と Markdown
も編集できます。ワープロ、表計算、プレゼンテーション編集、PDF 編集、
Markdown 編集という 6 つの Electron アプリが、1 つのエンジン層を共有して
います。

[![Meet GenOffice — the world's first full-featured open-source AI Office (video)](https://img.youtube.com/vi/B2pLdMX95v4/maxresdefault.jpg)](https://www.youtube.com/watch?v=B2pLdMX95v4)

[デモ動画を YouTube で見る](https://www.youtube.com/watch?v=B2pLdMX95v4)

## 機能

- **本物の PDF 編集** — ページそのもののテキストを打ち直し、画像を編集。
  元のフォントは保持されます。
- **Microsoft Word 互換で、バイト保持の `.docx` 編集** — 触った箇所だけが
  変わります。Word 側は違いに気づきません。
- **Word に忠実なページネーション** — 改ページ位置は Word と同じ場所に
  来ます。
- **Excel 互換のスプレッドシート** — 自前エンジンと Rust の `.xlsx`
  sidecar、自前のグラフ、ピボットテーブル、スライサー。
- **PowerPoint 互換のプレゼンテーション** — 自前の `.pptx` エンジン。
  マスター、レイアウト、スマートガイド、非破壊クロップ。
- **Markdown から Word へ、完全ローカル** — 同じ OOXML エンジン。Pandoc
  もクラウドも使いません。
- **文書を編集する AI** — スナップショットと diff 付きのブロック単位編集、
  文書を理解するエージェント。
- **組み込みのエージェントツール** — Web / 画像検索、画像生成、メディア
  解析。
- **ライト / ダーク / システムテーマ。**
- **macOS、Windows、Linux。**
- **無料かつオープンソース（Apache-2.0）。**

## ダウンロード

| プラットフォーム                           | 要件                                                   | ダウンロード                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **macOS** — Apple Silicon (arm64)          | macOS 11+                                              | [GenOffice-0.6.101-arm64.dmg](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/GenOffice-0.6.101-arm64.dmg)   |
| **macOS** — Intel (x64)                    | macOS 11+                                              | [GenOffice-0.6.101.dmg](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/GenOffice-0.6.101.dmg)               |
| **Windows** (x64)                          | Windows 10+                                            | [GenOfficeSetup-v0.6.101.exe](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/GenOfficeSetup-v0.6.101.exe)   |
| **Linux** — Debian / Ubuntu                | x86_64、glibc 2.34+（Ubuntu 22.04 以降）               | [genoffice_0.6.101_amd64.deb](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/genoffice_0.6.101_amd64.deb)   |
| **Linux** — Fedora / RHEL / openSUSE       | x86_64、glibc 2.34+（Fedora 35+、RHEL 9+、Leap 15.6+） | [genoffice-0.6.101.x86_64.rpm](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/genoffice-0.6.101.x86_64.rpm) |
| **Linux** — その他のディストリビューション | x86_64、glibc 2.34+、FUSE 2                            | [GenOffice-0.6.101.AppImage](https://github.com/genspark-ai/genoffice/releases/download/v0.6.101/GenOffice-0.6.101.AppImage)     |

すべてのビルドは `main` から作られます。macOS と Windows のインストーラは
署名済みです。古いバージョンは
[Releases](https://github.com/genspark-ai/genoffice/releases) ページにあり
ます。

### Linux へのインストール

deb は apt でインストールします。依存関係を取り込み、アプリケーション
メニューに GenOffice を追加します:

```bash
sudo apt install ./genoffice_0.6.101_amd64.deb
```

Fedora / RHEL 系 / openSUSE では、代わりに rpm をインストールします:

```bash
sudo dnf install ./genoffice-0.6.101.x86_64.rpm     # Fedora / RHEL family
sudo zypper install ./genoffice-0.6.101.x86_64.rpm  # openSUSE
```

AppImage は、その場で実行します。FUSE 2 ランタイムをインストールし
（`sudo apt install libfuse2`。Ubuntu 24.04 ではパッケージ名は
`libfuse2t64`）、ファイルを実行可能にしてから起動します:

```bash
chmod +x GenOffice-0.6.101.AppImage
./GenOffice-0.6.101.AppImage
```

## アプリ

| アプリ          | 製品                   | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs`     | **GenOffice Docs**     | `.docx` ワープロ。バイト保持のラウンドトリップ: 汚れた段落だけを再生成し（paragraph patch）、元ファイルのそれ以外はバイト単位で保持するため、開いて保存しても Word のレイアウトを壊しません。元文書のレイアウトを再現する行メトリクス付きのページネーション表示、変更履歴、コメント、スタイル、数式、インク。                                                                                                                                                                                                                                  |
| `apps/sheets`   | **GenOffice Sheets**   | `.xlsx` スプレッドシート。UI はオープンソースの [Univer](https://github.com/dream-num/univer) コア（Apache-2.0）の上に、自前の拡張を大きく載せています。`.xlsx` の import/export は自前の Rust sidecar（calamine + IronCalc）経由、グラフは自前描画（Konva）。加えてピボットテーブル、スライサー、条件付き書式、数式トレース。                                                                                                                                                                                                                 |
| `apps/slides`   | **GenOffice Slides**   | `.pptx` プレゼンテーション。自前の `.pptx` 解析 / 描画 / 編集エンジン。マスター、グラフ、クロップ、インク、テキストシェーピング（HarfBuzz メトリクス）。                                                                                                                                                                                                                                                                                                                                                                                       |
| `apps/pdf`      | **GenOffice PDF**      | [pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0）+ [pdf-lib](https://github.com/Hopding/pdf-lib)（MIT）上の `.pdf` ビューア / エディタ: 注釈、フォーム、アウトライン、スタンプ、署名、ページ操作、印刷。本物のテキスト編集 — 段落選択とブロック内リフロー、配置の復元、元フォントの保持 — と、コンテンツストリームへの画像挿入 / 編集。いずれも [PDFium](https://pdfium.googlesource.com/pdfium/) wasm（BSD-3-Clause）経由でページのコンテンツストリームを書き直し、サブセット埋め込みフォントを使います。覆い隠し注釈ではありません。 |
| `apps/markdown` | **GenOffice Markdown** | `.md` / `.markdown` エディタ: プレーンな Markdown ファイル上の Tiptap ブロックエディタ — 見出し、リスト、表、画像、コードブロック — をプレーン Markdown として保存し、シェルのタブでホストします。                                                                                                                                                                                                                                                                                                                                             |
| `apps/shell`    | **GenOffice**          | スイートのシェル: ホーム画面、5 つのエディタのタブホスト、ライト / ダーク / システムテーマ、自動更新。                                                                                                                                                                                                                                                                                                                                                                                                                                         |

すべてのアプリに同じ AI パネルが埋め込まれています。Docs ではバージョン
スナップショットと diff 付きのブロック粒度の AI 編集、それ以外では
ワークブック / スライド / PDF 状態に対するツール呼び出しエージェントです。

スイート全体は、共有デザイントークン（`packages/ui`）の上に構築した
ライト / ダーク / システム UI テーマを同梱し、CI ガードが chrome 色を
トークン体系に留めます。ドキュメント面はダークモードでもライトのまま
です — Word 流の、白い紙を囲む暗い chrome — そのため、ファイルの描画と
書き出しは両テーマで同一になります。

**AI バックエンド（Genspark）。** アプリはデバイスコードフローで
Genspark アカウントにサインインします。ユーザーがモデル API キーを入力
したり保存したりすることはありません。モデル呼び出しは Genspark
プロキシ経由です（Claude、GPT、Gemini 系列）。同じアカウントで、
エージェントが土台にする Genspark（"gsk"）ツールエンドポイント —
Web / 画像検索、画像生成と編集、画像 / 音声 / 動画解析、音声文字起こし —
も使えます。エージェント層を拡張する人は、すべて
`packages/ai-search` 経由で到達できます。

## エンジンパッケージ

すべて純粋な TypeScript で、Electron 依存はなく、単体テスト済みです
（UI キットを除く）:

- `packages/docx-engine` — docx 解析 → ブロックツリー（`docxIndex`
  アンカーとパススルー付き）、OOXML フラグメント生成、バイト単位の段落
  パッチ。
- `packages/pptx-engine` / `packages/pptx-render` — pptx モデルと描画。
- `packages/file-parse` — AI 添付向けのテキスト抽出（Office 形式、
  テキスト形式）。
- `packages/agent-core` — 全アプリが共有する AI エージェントループと
  スキル合成。
- `packages/ai-provider` — モデルバックエンド向けのプロバイダ抽象と
  ストリーミング。
- `packages/ai-search` — Genspark 認証 + Web / 画像検索ツール。
- `packages/i18n`、`packages/ui`、`packages/project-store`、
  `packages/electron-utils` — 共有 i18n コア、React UI キット、最近使った
  ファイルのストア、Electron main プロセス用ヘルパー。

## 開発

```bash
npm install
npm run fixtures     # generate test .docx fixtures
npm run test         # engine + app unit tests (docs/sheets/slides need no display)
npm run typecheck    # tsc --noEmit across every workspace
npm run dev          # all five editors + shell against Vite dev servers
npm run dev:docs     # a single app (same pattern works per workspace)
npm run dist:mac     # package macOS dmg (regenerates third-party notices)
npm run dist:win     # package Windows nsis installer
npm run dist:linux   # package Linux AppImage + deb + rpm
```

Sheets アプリは、xlsx sidecar 用に Rust ツールチェーン（PATH 上の
`cargo`）が追加で必要です。`npm run build -w @genoffice/sheets` が自動で
コンパイルします。

ローカル UI / e2e ドライバスクリプト（Playwright + Electron。ローカル
受け入れ用で、既定ではコミットしません）は
[`scripts/drivers/`](scripts/drivers/README.md) にあります。

## アーキテクチャメモ（docx ラウンドトリップ）

```
open docx ─► archive original by hash (never touched)
          ─► docx-engine parses word/document.xml top-level elements (w:p / w:tbl / …)
          ─► Block tree, each block anchored by docxIndex + original XML slice
          ─► Tiptap streaming editor (manual + AI editing, dirty tracking)
save      ─► dirty blocks → OOXML fragments (referencing existing styles only)
          ─► splice into original document.xml (untouched blocks keep original bytes)
          ─► repack zip; all other entries copied byte-for-byte
```

同じ考え方は Sheets と Slides にも当てはまります。元ファイルが情報源
（source of truth）であり、編集は狭いパッチとして適用され、エディタが
触らなかったものはラウンドトリップ後も未変更のまま残ります。

## FAQ

**GenOffice は無料ですか？**
はい。GenOffice は Apache-2.0 ライセンスの無料オープンソースです。アプリ
本体に試用期間も有料プランもありません。

**GenOffice は Microsoft Word、Excel、PowerPoint のファイルを開けますか？**
はい。GenOffice はネイティブの `.docx`、`.xlsx`、`.pptx` を開いて保存
します。保存はバイト保持です。触っていない部分はバイト単位で書き戻す
ため、文書は Microsoft Office でも動き続けます。

**GenOffice はオフラインで動きますか？**
文書編集は完全にローカルです。開く、編集する、保存するためにファイルが
マシンの外へ出ることはありません。AI 機能（エージェント、検索、画像
ツール）は Genspark アカウントにサインインし、ネットワーク接続が必要
です。

**GenOffice は PDF ファイルを編集できますか？**
はい。本物の PDF テキスト / 画像編集で、元のフォントを保持したまま
ページのコンテンツストリームを書き直します。覆い隠し注釈ではありません。

## セキュリティ

プロセスのセキュリティ姿勢（レンダラーのサンドボックス、IPC 検証、
外部リンクのゲート）と、AI 生成コンテンツの脅威モデルは
[SECURITY.md](SECURITY.md) を参照してください。

## 謝辞

GenOffice は、次のオープンソースプロジェクトなしには成り立ちません:

- [Electron](https://www.electronjs.org/) — 全アプリのデスクトップ
  ランタイム。
- [Univer](https://github.com/dream-num/univer)（Apache-2.0）— Sheets が
  拡張するスプレッドシート UI コア。
- [PDFium](https://pdfium.googlesource.com/pdfium/)（BSD-3-Clause、
  [@embedpdf/pdfium](https://github.com/embedpdf/embed-pdf-viewer)
  経由で同梱）— 本物の PDF テキスト / 画像編集の背後にあるコンテンツ
  ストリームエンジン。
- [pdf.js](https://github.com/mozilla/pdf.js)（Apache-2.0）と
  [pdf-lib](https://github.com/Hopding/pdf-lib)（MIT）— PDF 描画と
  文書組み立て。
- [Tiptap](https://tiptap.dev/) / [ProseMirror](https://prosemirror.net/)
  — Docs と Markdown のブロックエディタ。
- [Konva](https://konvajs.org/) — Slides と Sheets グラフのキャンバス
  描画。
- [HarfBuzz](https://github.com/harfbuzz/harfbuzz)（wasm）— 複雑な文字
  体系向けのテキストシェーピングメトリクス。
- [calamine](https://github.com/tafia/calamine) と
  [IronCalc](https://github.com/ironcalc/IronCalc) — Rust xlsx sidecar
  の読み取り層と計算層。
- Liberation、Carlito、Caladea、Noto CJK フォント（OFL/Apache-2.0）—
  同梱の文書フォント。

## サードパーティ通知

`npm run notices` は、同梱のサードパーティライセンス要約を再生成します
（`tools/gen-third-party-notices.mjs`）。実行時依存はすべて
MIT/Apache-2.0/BSD-3-Clause/OFL で、同梱フォント（Liberation、Carlito、
Caladea、Noto CJK サブセット）は OFL/Apache です。

## ライセンス

GenOffice は [Apache License 2.0](LICENSE) の下でライセンスされます。
例外が 1 つあります。`ee/` ディレクトリは将来のエンタープライズ
モジュール用に予約されており、
[GenOffice Enterprise License](ee/LICENSE) の対象です。

GenOffice と Genspark の名称およびロゴは Mainfunc, Inc. の商標です。
Apache-2.0 ライセンスはそれらの使用許諾を与えません（第 6 条を参照）。
フォークは独自のブランディングを使うべきです。
