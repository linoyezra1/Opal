# עיצוב דף תשלום Cardcom (Low Profile)

קבצים להדבקה בממשק Cardcom → **עיצוב דף תשלום** → HTML / CSS מותאמים.

## קבצים

| קובץ | היכן להדביק |
|------|-------------|
| `opal-low-profile.css` | שדה **CSS מותאם** (החלף/הדבק את כל ה-CSS הישן) |
| `opal-low-profile-html-snippet.html` | **הערות HTML** (`HtmlComments`) או תחילת בלוק HTML |
| HTML ברירת מחדל של Cardcom | השאירי את התבנית הקיימת (עם כל ה-`data-bind`) — אל תמחקו שדות |

## שדות חובה ל-3DS (הגדרה בממשק Cardcom)

בממשק הניהול של Cardcom, סמנו כ**חובה** ו**גלויים** (לא מוסתרים):

- שם בעל הכרטיס / שם מלא — `cardOwnerName` / `txtCardOwnerName`
- טלפון — `cardOwnerPhone` / `txtCardOwnerPhone`
- אימייל — `cardOwnerEmail` / `txtCardOwnerEmail`

אופציונלי גם בפרטי חשבונית: `txtCustName`, `txtCustMobilePH`, `txtEmail`.

ה-CSS מסמן שדות אלה בכוכבית אדומה; האכיפה בפועל נעשית בהגדרות השדות ב-Cardcom.

## תצוגה מקומית

פתחו בדפדפן: `cardcom-payment-preview-mock.html` בשורש הפרויקט (מוק מקומי, לא דף Cardcom אמיתי).

## עיצוב

- רקע לבן נקי
- תוויות מעל השדות
- רשת רספונסיבית: מספר כרטיס ברוחב מלא, תוקף+CVV בשורה, ת.ז.+טלפון, שם מלא, מייל
- כפתור תשלום כחול מלא רוחב
- מצבי שגיאה/הצלחה (אדום/ירוק) תואמים למחלקות Cardcom `errorRow` / `success`
