# GenOffice Cursor リポジトリ手順

このフォーク固有の手順はリポジトリ全体に適用する。Upstream は現時点で
`AGENTS.md` を提供していない。同期時にこのファイルを Upstream の製品
ドキュメントで置き換えないこと。

## まず情報源（source of truth）から始める

- Cursor 統合の作業を計画する前に `docs/cursor/README.md` を読み、その権威の
  順序と `REFERENCE_CATALOG.md` の案内に従う。
- `docs/cursor/SLIDES_MVP_REQUIREMENTS.md` をユーザー向け契約、
  `ARCHITECTURE.md` を目標境界、`IMPLEMENTATION_PLAN.md` を依存順序、
  `TEST_PLAN.md` を証跡契約として扱う。
- 目標ドキュメントは、まだ存在しない意図された振る舞いを記述する。機能が
  実装済みだと主張する前に、現行のコードとテストを確認する。
- 専門作業には、最も近い入れ子の `AGENTS.md` を適用する。リポジトリルートで
  開始したセッションは、次を明示的に読むこと:
  - Slides または Cursor エージェント経路を変更する前に
    `apps/slides/AGENTS.md`。
  - `docs/cursor/**` または `docs/adr/**` を変更する前に
    `docs/cursor/AGENTS.md`。
- Upstream リポジトリの慣習は `CONTRIBUTING.md`、UI テーマと Electron
  ビルドの注意点は `CLAUDE.md` に従う。

## 製品スコープ

- これは所有者の Mac 向けの非公開・個人利用フォークである。明示的に依頼され
  ない限り、公開配布、公開ブランディング、更新サービスを追加しない。
- 現在の MVP は Slides のみである。すべての Slides 受け入れシナリオが通る
  まで、Sheets、Docs、PDF、Markdown 向けの Cursor ツールを実装しない。
- 主経路は、Genspark がログアウト済みで GSK 資格情報が無い状態でも、Cursor
  アカウントで動作しなければならない。既存の Upstream Genspark 振る舞いは
  任意の互換経路として残してよいが、MVP の依存ではない。
- 文書状態、描画、undo/redo、OOXML の import/export の権威は GenOffice の
  ままである。エージェントは狭いコマンドを呼ぶ。PPTX、XLSX、DOCX
  アーカイブを直接書き込んではならない。
- ネイティブで編集可能な Office コンテンツを優先する。初期の Slides 図は、
  ビットマップでも意味的な PowerPoint SmartArt でもなく、編集可能な図形
  グループである。白紙からの作成は `compose_slide` の閉じたカタログ
  (`title_kicker`, `input_cycle_outputs`, `insight_table`, `bar_comparison`)
  を使い、表と棒グラフはテンプレート内部でのみ挿入する。数値はユーザー
  プロンプト由来に限る。SDK サブエージェントは使わない。約 30 枚のデッキ
  生成は MVP 後の目標であり、受け入れ契約ではない。詳細は
  `docs/cursor/PRODUCT.md` と
  [ADR 0003](docs/adr/0003-quality-first-native-slide-composition.md)。

## Git と Upstream の安全

- `origin` は `RYUKOU-OKUMURA/genoffice-cursor`、`upstream` は fetch 専用の
  公式 `genspark-ai/genoffice` リポジトリである。
- `main` は `upstream/main` のクリーンな fast-forward ミラーとして保つ。
  フォーク作業はすべて `cursor`、または `cursor` から作成した焦点を絞った
  `feature/*` ブランチに置く。
- Upstream のスナップショットは `cursor` にマージし、衝突はその場で解消
  する。フォークのコミットを `main` に追加したり、公開済みブランチ履歴を
  rebase したり、force-push したり、公式リポジトリへ push したりしない。
- 毎回の push 前に、ブランチと `git remote -v` を確認する。インストール済み
  フックを `tools/git-hooks/pre-push-fork-safety` と同期させ、新しい
  checkout ごとに `docs/cursor/OPERATIONS.md` の手順でインストールする。
- 汚れた worktree にある無関係なユーザー変更は保持する。小さく焦点を絞った
  変更を、命令形の英語件名でコミットする。

## インストール済みアプリとローカルデータの安全

- ソースの変更は、公式にインストールされた `GenOffice.app` を更新しない。
- MVP 開発中は、フォークをパッケージせず次で実行する:

  ```bash
  GENOFFICE_USER_DATA="$PWD/.task/user-data" npm run dev
  ```

- Phase 7 と ADR 0001 の別製品名、bundle ID、明示的な user-data パスが実装
  されるまで、フォークをパッケージまたはインストールしない。
- 個人ビルドで公式 GenOffice の更新フィードを使わない。
- 生成したフィクスチャまたはコピーでテストする。同じ PPTX を公式アプリと
  個人アプリで同時に開いて保存しない。
- 資格情報、SDK ストア、ローカルスキル、ユーザー文書、文書内容を含むログ、
  `.task/user-data` の状態をコミットしない。

## 変更の規律

- `docs/cursor/IMPLEMENTATION_PLAN.md` のフェーズ順で作業する。直前の exit
  gate が通るまで、ツール面を広げない。
- Cursor 統合は加算的かつ隔離して保ち、Upstream のエンジン更新をきれいに
  マージできるようにする。既存のエディタ変更を複製または迂回するのではなく、
  共有コマンドサービスを抽出する。
- `apps/*/out`、`release`、`node_modules` などの生成物や依存ツリーを編集
  しない。タスクが必要とするときだけ、リポジトリのコマンドで再生成する。
- クリーンインストールには `npm ci` を使う。意図した依存変更のときだけ
  `npm install` を使い、lockfile とライセンス影響を確認する。
- コード、コメント、コミットメッセージ、開発者向けドキュメントは英語のみ。
  ユーザー向け文言は i18n リソースに置く。
- ユーザーが繰り返しの前提を訂正したときは、所管の `docs/cursor/`
  ドキュメントまたは ADR を更新する。その訂正が今後の作業を毎回律すべき
  ときだけ `AGENTS.md` を更新する。
- サブエージェントが使えるときは、範囲を限った独立調査に使い、自明でない
  変更をコミットする前に独立した最終レビューを必須とする。

## 検証と引き渡し

- 反復中は、関連する最小のワークスペース typecheck とテストを実行する。
- コードコミット前に、フォーマット、lint、影響を受けるワークスペースの
  typecheck、影響を受けるテストを実行する。フェーズ出口、または共有依存 /
  ビルド経路が変わるときは、`CONTRIBUTING.md` が求める全ゲートを実行する。
- OOXML の open/save 変更には、意図した変更と未変更コンテンツの保持を証明
  するラウンドトリップテストが必要である。
- ドキュメントのみの変更には、`npm run format:check`、有効なローカルリンク、
  現行コード・ADR・実装計画との整合が必要である。
- コマンドがゼロ終了しても、警告は報告すべき証跡として扱う。最終引き渡し
  では、実行したコマンド、結果、意図的に省略した検査を列挙する。

## コードレビュー規則

次をブロッカーとして扱う:

- Cursor 受け入れ経路が黙って Genspark を呼ぶ。
- ワーカーが任意のシェル、ファイルシステム、環境 MCP、ネットワークツール、
  またはサブエージェント能力を得る。
- レンダラーが資格情報を受け取る、または型付き preload と main プロセス
  検証の外でデッキを変更できる。
- タブ / デッキ変更後に run が対象を付け替えられる、または履歴バッチが
  開いたままになる。
- 個人パッケージが公式アプリを置き換えられる、ユーザーデータを共有する、
  またはその更新フィードを使う。
- エージェントの変更が、既存のコマンド、undo、描画、または保存の振る舞いを
  迂回する。
