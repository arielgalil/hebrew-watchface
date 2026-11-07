# שעון עברי | Hebrew Watch Face

פני שעון עבריים ל-**Amazfit GTR 4** (Zepp OS, מסך עגול 466x466): תאריך עברי עם גימטריה, חגים וספירת העומר, הדלקת נרות וצאת שבת, סוללה וצעדים.
Hebrew-date watch face for the Amazfit GTR 4, with holidays, the omer, candle lighting and Shabbat end times.

**עמוד הפרויקט / project page:** התיקייה `docs/` (GitHub Pages).
**הורדה / download:** `docs/downloads/Hebrew_Date-466.zip` ו-`Hebrew_Date-480.zip`, לפי גודל המסך (גרסה 2.4.3, appId 1134151).

## מה יש בפנים
- תאריך עברי בגימטריה (כולל ט״ו/ט״ז, אדר א׳/ב׳), "אור ל-…" אחרי השקיעה.
- חגים לפי מנהג ישראל, חנוכה עם נר הערב, ספירת העומר.
- הדלקת נרות מיום שישי האזרחי (או ערב חג) עד השקיעה, ואחריה צאת שבת/חג (20 דקות לפני השקיעה, 40 אחריה).
- זמני השמש לפי נוסחת NOAA, בסדר מקורות: GPS וברומטר של השעון > נתוני Zepp מהסנכרון (עם תיקון שעון קיץ) > ירושלים.
- בשורה התחתונה, כשאין הדלקת נרות: שקיעה עד השקיעה וזריחה עד הזריחה.
- סוללה וצעדים, נקודת שניות על המסגרת, מסך תמיד דלוק.

## מבנה התיקייה
| נתיב | תוכן |
|---|---|
| `new_face/index.template.js` | קוד הפנים (לוח שנה, חגים, זמני שמש, ווידג'טים) |
| `tools/build_v3.py` | בונה נכסים, `index.js`, הדמיות ו-zip (466 כברירת מחדל, `FACE_SIZE=480` למסכי 480) |
| `tools/make_zab.py` | אורז את ה-zip של שני הגדלים לקובצי ZAB לקונסולת Zepp, ב-`new_face/dist/` |
| `tools/make_gif.py` | גיף תצוגה עגול עם רקע שקוף, ב-`new_face/dist/` |
| `tools/zepp_img.py` | המרת תמונות לפורמט הנכסים של Zepp (TGA מקומפל) |
| `tools/simulate.cjs`, `render.py`, `check_dates.cjs` | סימולטור, רינדור ובדיקת התאמה למסך |
| `tools/sync.sh` | בטלפון (Termux): בנייה ופתיחה להתקנה |
| `src/` | הגרסה הראשונה (v2), לעיון |
| `research/` | חישוב פרשת השבוע (אב-טיפוס בלבד) |
| `archive/sun_moon/` | ניסוי עיצוב עם קשת שמש וירח |
| `archive/design_comparisons/` | תמונות השוואה מתהליך העיצוב |
| `docs/` | עמוד הפרויקט |
| `LICENSE`, `THIRD_PARTY.md`, `fonts/OFL.txt` | רישיונות |
| `DECISIONS.md` | ההחלטות הסופיות: פריסה, חישובים, מקורות זמן |

## בנייה
```
python3 -I tools/build_v3.py          # דורש Pillow ו-numpy, וגם Node
FACE_SIZE=480 python3 -I tools/build_v3.py   # מסכי 480
python3 -I tools/make_zab.py          # קובצי ZAB להעלאה לקונסולה
python3 -I tools/make_gif.py          # גיף תצוגה עם רקע שקוף
node tools/check_dates.cjs new_face/package/watchface/default-target/index.js 2024 2045
TZ=Asia/Jerusalem node tools/simulate.cjs new_face/package/watchface/default-target/index.js 2026-10-30T10:00:00
```
הנתונים של `research/hebcal` לא כלולים (הורדה מ-hebcal.com).

## רישיון
הקוד והתיעוד ברישיון **MIT** (`LICENSE`). הגופנים בתיקייה `fonts/` (Heebo, Rubik) ברישיון **SIL OFL 1.1** (`fonts/OFL.txt`). רכיבים נוספים של אחרים מפורטים ב-`THIRD_PARTY.md`.

## הערות
- הזמנים מחושבים ואינם פסיקה הלכתית. מנהגי הדלקה שונים בין ערים (בירושלים 40 דקות), ויש לוודא מול לוח מוסמך.
- נבדק בסימולטור בלבד. לא נבדק על שעון בכל השילובים (התקנה עם ההרשאות החדשות, GPS מפני שעון).
- פרויקט אישי, ללא קשר ל-Zepp Health או ל-Amazfit.
