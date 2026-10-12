# QR Inspector Pro

通常QRコード、Micro QR、rMQRを画像から読み取り、デコーダーが返したペイロードのバイト列をHEX・ASCIIで調べるブラウザツールです。

## 現在の機能

- QR画像：ファイル選択、ドラッグ＆ドロップ、クリップボード画像貼り付け
- 1枚の画像に複数のコードがある場合、検出結果の選択欄で表示対象を切り替え
- カメラでQR読み取り（HTTPSまたはlocalhostが必要）
- 通常QR（Model 1 / Model 2）、Micro QR、rMQRの検出・読み取りをZXing-C++ WebAssemblyで実行
- デコーダーが返すペイロードバイト列を保持し、HEX / ASCII / UTF-8表示
- 任意ファイルを直接開き、ファイル自体のバイト列を調査
- HEX入力、HEXコピー、テキストコピー、`.bin`保存
- PNG / JPEG / GIF / WebP / BMP / ICOのシグネチャを検出し、ペイロード内に画像本体があれば表示を試みる
- QRのVersion（通常QRのV1〜V40、Micro QRのM1〜M4、rMQRの形式名など）・誤り訂正レベル・ECIなど、デコーダーが返す情報を表示（エンジンが値を返さない場合は未取得と表示）
- Node.js組み込みテストによるHEX処理、画像シグネチャ、Version式、モード判定ヘルパーの検証

## 起動方法

GitHub Pagesの公開設定で `main` ブランチのルートを指定します。

ローカルでは、Node.jsを使わずに次のように静的サーバーで起動できます。

```powershell
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。カメラ利用は `file://` ではなく、HTTPSまたはlocalhostを使ってください。

このアプリは `zxing-wasm@3.1.5` のReader IIFE版をCDNから読み込みます。初回のデコーダー読込にはインターネット接続が必要です。

## テスト

Node.js 20以降をインストールして、リポジトリのルートで実行します。

```powershell
npm test
```

## バイト列について

`ReadResult.bytes` はZXingのドキュメントで「文字コード変換などの変更を加えていないraw/standard content」と説明される、デコーダーが復元したペイロードのバイト列です。これはQRシンボル内部の全コードワード、誤り訂正前データ、モジュールのビット列と同じものではありません。

「強制読み取り」は、取得済みバイト列を文字列として解釈し直して表示する機能です。データを推測して作ったり、SQRCのアクセス制御を突破したりはしません。

## SQRCについて（未完了）

SQRCはデンソーウェーブの読み取り制限機能で、公開部と非公開部を持ち、見た目は通常QRと同じです。通常QRの読み取り失敗だけでは、画像がSQRCだと断定できません。

`js/sqrc-detector.js` は、誤り訂正後のデータビットストリームから標準QRのモード指示子を確認し、検証済みの専用指示子を設定すれば照合できるヘルパーです。通常QRの `0100` は4ビットのByteモード指示子です。ただし、SQRC専用の実際の指示子と、そのビットストリームを画像から安全に取り出す処理は、現時点でまだ接続・検証されていません。そのため、今のUIは復号できないコードを「SQRCの可能性」として案内するにとどめ、SQRCと確定表示しません。

SQRCの非公開データを本当に読み取る機能を完成させるには、正規のSQRC仕様・対応エンジンの情報と、モード判定・公開/非公開データの分離を検証するテスト用コードが必要です。8バイトの鍵入力欄を追加するだけでは、SQRC対応とはいえません。

## 参考資料

- [DENSO WAVE: SQRCとは](https://www.denso-wave.com/ja/system/qr/fundamental/qrcode/sqrc/index.html)
- [ISO/IEC 18004: QR Code bar code symbology specification](https://www.iso.org/standard/83389.html)
- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm)

このプロジェクトは、QRコードの画像や取得ペイロードを独自サーバーへ送信しません。ブラウザのライブラリCDN接続は別です。