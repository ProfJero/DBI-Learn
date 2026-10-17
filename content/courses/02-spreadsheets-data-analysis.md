---
slug: spreadsheets-data-analysis
title: Spreadsheets & Data Analysis with Excel
subtitle: Go from blank grid to confident analyst — formulas, functions, charts and real-world data skills employers want.
category: data-analysis
level: beginner
hours: 8
featured: true
tags: [excel, google sheets, formulas, charts, data analysis, budgeting]
outcomes:
  - Navigate a spreadsheet and enter, format and organise data correctly
  - Write formulas with relative and absolute references
  - Use essential functions such as SUM, AVERAGE, IF, COUNTIF, SUMIF and XLOOKUP
  - Clean messy data and sort, filter and validate it
  - Summarise data with PivotTables and present it with clear charts
  - Build practical tools such as a budget, a mark sheet and a sales report
requirements:
  - Complete Digital Literacy Essentials or be comfortable using a computer
  - Microsoft Excel, Google Sheets (free) or LibreOffice Calc — all lessons work in each
description: |
  Spreadsheets are the most widely used data tool in the world. Shops use them to track stock, teachers use them for marks, NGOs use them to report impact, and almost every office job asks for "good Excel skills".

  In this hands-on course you will learn spreadsheets the way professionals use them. Each lesson works through a realistic example — a market trader's sales, a class mark sheet, a family budget in cedis — so you can apply what you learn straight away. Everything works in Excel, Google Sheets and LibreOffice.
---

# Module: Spreadsheet foundations
Understand the grid, enter data correctly and make it readable.

## Lesson: Welcome to the grid (8 min)
A **spreadsheet** is a grid made of **rows** (numbered 1, 2, 3…) and **columns** (lettered A, B, C…). Where a row and column meet is a **cell**, named by its column then row: **B3** is column B, row 3. A file is called a **workbook**, and each tab at the bottom is a **worksheet** (or sheet).

### Why spreadsheets matter
- **Automatic calculations** — change one number and every total updates.
- **Organisation** — thousands of rows of data in a neat table.
- **Analysis** — sort, filter, summarise and chart in seconds.
- **Everywhere** — Excel, Google Sheets and LibreOffice Calc all work the same way.

### Finding your way around
- The **Name Box** (top-left) shows the selected cell's address.
- The **Formula Bar** shows what is really inside the cell — a number, text or formula.
- A **range** is a block of cells written with a colon: `A1:C10` means from A1 down to C10.
- `Ctrl + Arrow key` jumps to the edge of your data; `Ctrl + Home` returns to A1.

### Types of data
| Type | Example | Tip |
|---|---|---|
| Text | `Kumasi`, `Product name` | Left-aligned by default |
| Number | `250`, `12.5` | Right-aligned by default — never type "GH₵" inside the number |
| Date | `15/03/2026` | Stored as a number, so you can calculate with it |
| Formula | `=B2*C2` | Always starts with `=` |

> [!TIP]
> If a number is left-aligned, the spreadsheet may be treating it as text. That often happens when you copy data from the web or type a space before it.

> [!TRY]
> Open a new spreadsheet. In A1 type **Item**, in B1 **Quantity**, in C1 **Price (GH₵)**. Add five items you might buy at the market with quantities and prices.

## Lesson: Entering and formatting data like a pro (10 min)
Good structure makes everything later — formulas, charts, analysis — much easier.

### The golden rules of a data table
1. **One header row** with a clear name for each column.
2. **One record per row** (e.g. one sale, one student).
3. **One type of data per column** — don't mix numbers and notes.
4. **No blank rows or columns** in the middle of your data.
5. **Don't merge cells** inside a data table — it breaks sorting and filtering.

### Speed tricks
- **AutoFill:** type `Monday` in a cell, then drag the small square at its bottom-right corner (the *fill handle*) to fill the rest of the week. Works for numbers like 1, 2, 3 and dates too.
- **Flash Fill (Excel):** type an example of the pattern you want (e.g. first names from full names) and press `Ctrl + E`.
- `Ctrl + ;` inserts today's date.
- `Alt + Enter` starts a new line inside the same cell.

### Formatting for readability
- **Number formats:** use *Currency* or *Accounting* for money, *Percentage* for rates, and set decimal places consistently.
- **Bold the header row** and use **Freeze Panes** (*View → Freeze Top Row*) so headers stay visible as you scroll.
- **Format as Table** (Excel `Ctrl + T`) adds banded rows, filters and makes formulas easier.
- Keep colours simple: one highlight colour for headers, one for warnings.

> [!WARNING]
> Formatting changes how a number *looks*, not its value. A cell showing `GH₵ 3` might actually contain `2.6`. Use the ROUND function when you need the value itself rounded.

> [!TRY]
> Turn your market list into a proper table: bold headers, currency format on the Price column, freeze the top row and apply *Format as Table*.

## Lesson: Your first formulas (10 min)
Formulas make spreadsheets powerful. Every formula starts with an **equals sign (=)**.

### Arithmetic operators
| Operator | Meaning | Example | Result |
|---|---|---|---|
| `+` | Add | `=5+3` | 8 |
| `-` | Subtract | `=10-4` | 6 |
| `*` | Multiply | `=6*7` | 42 |
| `/` | Divide | `=20/4` | 5 |
| `^` | Power | `=2^3` | 8 |

The spreadsheet follows **BODMAS**: brackets first, then powers, then multiply/divide, then add/subtract. `=2+3*4` is 14, but `=(2+3)*4` is 20.

### Use cell references, not typed numbers
Instead of `=5*12`, write `=B2*C2`. Now if the quantity in B2 changes, the result updates automatically.

For our market list, add a column **D: Total** and in D2 type:

```
=B2*C2
```

Press **Enter**, then drag the fill handle down. The formula adjusts for each row: D3 becomes `=B3*C3`, D4 becomes `=B4*C4`. This is called a **relative reference**.

### Absolute references with $
Sometimes one cell must stay fixed. Suppose a 15% VAT rate is in cell **G1**. In E2 you want `=D2*G1`. If you drag it down, E3 would become `=D3*G2` — wrong! Lock the reference with dollar signs:

```
=D2*$G$1
```

`$G$1` is an **absolute reference**: it never changes when copied. Press **F4** after typing a reference to add the `$` signs automatically.

> [!TIP]
> `$G1` locks only the column; `G$1` locks only the row. These *mixed references* are handy for multiplication tables and grids.

> [!TRY]
> Put `0.15` in G1 with the label "VAT rate" in F1. Add a column **VAT** that calculates `=D2*$G$1` and a **Grand total** column `=D2+E2`. Fill both down.

## Quiz: Practice — references {kind=practice pass=60}
### Q: You copy the formula `=B2*C2` from row 2 down to row 5. What does it become in row 5?
- [ ] =B2*C2
- [x] =B5*C5
- [ ] =B5*C2
- [ ] =$B$5*$C$5
> Relative references move with the formula, so row 2 becomes row 5.

### Q: Which reference stays exactly the same when copied anywhere?
- [ ] G1
- [ ] $G1
- [ ] G$1
- [x] $G$1
> Dollar signs before both the column and row make an absolute reference.

### Q(short): What is the result of `=(2+3)*4`?
= 20
> Brackets are calculated first: 5 × 4 = 20.

## Quiz: Module 1 quiz — Foundations {pass=70}
### Q: What is the address of the cell in column C, row 7?
- [ ] 7C
- [x] C7
- [ ] C:7
- [ ] R7C
> Cell addresses are column letter followed by row number.

### Q: Which of these is a good rule for a data table?
- [ ] Merge the header cells to make them look nicer
- [ ] Leave a blank row between every record
- [x] Put one record per row and one type of data per column
- [ ] Mix notes and numbers in the same column
> Clean, consistent tables can be sorted, filtered and analysed reliably.

### Q: What does `=2+3*4` return?
- [ ] 20
- [x] 14
- [ ] 24
- [ ] 9
> Multiplication happens before addition: 3×4 = 12, plus 2 = 14.

### Q(tf): Applying currency format to a cell changes the value stored in it.
= false
> Formatting only changes how the value is displayed, not the value itself.

### Q: Which key adds dollar signs to a cell reference while editing a formula in Excel?
- [ ] F2
- [x] F4
- [ ] F9
- [ ] Ctrl + $
> F4 cycles through absolute, mixed and relative references.

# Module: Essential functions
Use built-in functions to calculate, count, decide and look up.

## Lesson: SUM, AVERAGE, MIN, MAX and COUNT (9 min)
A **function** is a ready-made formula. You write its name followed by **arguments** in brackets: `=FUNCTION(arguments)`.

### The big five
Suppose a teacher has test scores for 30 students in **B2:B31**.

| Function | Example | What it gives |
|---|---|---|
| `SUM` | `=SUM(B2:B31)` | Total of all scores |
| `AVERAGE` | `=AVERAGE(B2:B31)` | The mean score |
| `MIN` | `=MIN(B2:B31)` | Lowest score |
| `MAX` | `=MAX(B2:B31)` | Highest score |
| `COUNT` | `=COUNT(B2:B31)` | How many cells contain numbers |

Related counters:
- `COUNTA` counts cells that are **not empty** (text too) — useful for counting names.
- `COUNTBLANK` counts empty cells — useful to see who hasn't submitted.

### AutoSum shortcut
Select the cell just below a column of numbers and press **Alt + =**. Excel guesses the range and writes the SUM for you.

### Rounding
- `=ROUND(B2, 1)` rounds to 1 decimal place.
- `=ROUNDUP` and `=ROUNDDOWN` always go up or down.

### The status bar
Select any range and look at the bottom of the window: Excel shows the **Sum, Average and Count** instantly — no formula needed. Great for quick checks.

> [!TIP]
> Functions ignore empty cells and text when calculating SUM and AVERAGE. A student who was absent (blank) does not pull the average down — but a 0 does. Decide which you mean!

> [!TRY]
> Create a mark sheet with 10 students and 3 subjects. Add a **Total** column using SUM and an **Average** row using AVERAGE. Find the highest and lowest total with MAX and MIN.

## Lesson: Making decisions with IF (10 min)
The **IF** function lets the spreadsheet make a decision:

```
=IF(logical_test, value_if_true, value_if_false)
```

### Pass or fail
If a score in B2 of 50 or more is a pass:

```
=IF(B2>=50, "Pass", "Fail")
```

### Comparison operators
| Operator | Meaning |
|---|---|
| `=` | equal to |
| `<>` | not equal to |
| `>` / `<` | greater than / less than |
| `>=` / `<=` | greater than or equal / less than or equal |

Text must be in double quotes: `=IF(C2="Paid", 0, D2)`.

### Grading with nested IF or IFS
To award grades A–F you can nest IFs, but **IFS** (Excel 2019+, Google Sheets) is easier to read:

```
=IFS(B2>=80,"A", B2>=70,"B", B2>=60,"C", B2>=50,"D", TRUE,"F")
```

The final `TRUE` acts as "everything else".

### Combining conditions with AND / OR
- `=IF(AND(B2>=50, C2>=50), "Promoted", "Repeat")` — both conditions must be true.
- `=IF(OR(D2="Absent", D2=""), "Follow up", "OK")` — either can be true.

> [!WARNING]
> A common mistake is typing curly “smart quotes” copied from Word. Spreadsheets only accept straight quotes `"`.

> [!TRY]
> Add a **Grade** column to your mark sheet using IFS, and a **Status** column that says "Promoted" only if the average is 50 or more *and* no subject is below 40.

## Lesson: COUNTIF, SUMIF and XLOOKUP (11 min)
These three functions answer most everyday business questions.

### COUNTIF — "how many…?"
```
=COUNTIF(range, criteria)
=COUNTIF(E2:E31, "Pass")        how many passed
=COUNTIF(B2:B31, ">=80")        how many scored 80 or more
```

### SUMIF — "how much for…?"
A shop records sales with the product in column B and amount in column D:

```
=SUMIF(B2:B500, "Rice", D2:D500)
```

adds all sales amounts where the product is Rice. For several conditions use **SUMIFS**:

```
=SUMIFS(D2:D500, B2:B500, "Rice", C2:C500, "Accra")
```

(Note that in SUMIFS the sum range comes *first*.) There is also **COUNTIFS** and **AVERAGEIF(S)**.

### XLOOKUP — find information in a table
Suppose a price list has product names in **A2:A50** and prices in **B2:B50**. To find the price of the product typed in E2:

```
=XLOOKUP(E2, A2:A50, B2:B50, "Not found")
```

It reads: *look up E2, in the list A2:A50, return the matching value from B2:B50; if there is no match, show "Not found".*

If your version doesn't have XLOOKUP, use **VLOOKUP**:

```
=VLOOKUP(E2, A2:B50, 2, FALSE)
```

`2` means "return the 2nd column" and `FALSE` means "exact match only". Always use FALSE unless you know why you need TRUE.

> [!TIP]
> Lookups fail when there are extra spaces: "Rice " is not the same as "Rice". Wrap values in `TRIM()` to clean them.

> [!TRY]
> Build a small price list of 8 products. On another sheet, type a product name and use XLOOKUP (or VLOOKUP) to show its price automatically.

## Quiz: Module 2 quiz — Functions {pass=70}
### Q: Which formula counts how many students scored 80 or above in B2:B31?
- [ ] =COUNT(B2:B31>=80)
- [x] =COUNTIF(B2:B31, ">=80")
- [ ] =SUMIF(B2:B31, ">=80")
- [ ] =IF(B2:B31>=80)
> COUNTIF counts the cells in the range that meet the criterion.

### Q: What does `=IF(B2>=50, "Pass", "Fail")` return when B2 is 49?
- [ ] Pass
- [x] Fail
- [ ] 49
- [ ] An error
> 49 is not greater than or equal to 50, so the "false" value is returned.

### Q: In `=VLOOKUP(E2, A2:B50, 2, FALSE)`, what does FALSE mean?
- [ ] Return nothing if the cell is empty
- [x] Only accept an exact match
- [ ] Search from the bottom
- [ ] Ignore capital letters
> FALSE forces an exact match, which is what you want for names and codes.

### Q(multiple): Which functions can add up values that meet a condition?
- [x] SUMIF
- [x] SUMIFS
- [ ] COUNTA
- [ ] MAX
> SUMIF handles one condition; SUMIFS handles one or more.

### Q(short): Which function counts cells that are not empty, including text? (function name only)
= COUNTA | =COUNTA | counta()
> COUNT only counts numbers; COUNTA counts any non-empty cell.

# Module: Organising and cleaning data
Sort, filter, clean and protect your data so your analysis is trustworthy.

## Lesson: Sorting and filtering (8 min)
Large tables are only useful if you can find what you need.

### Sorting
Select any cell inside your table and use **Data → Sort**.

- **A → Z** sorts text alphabetically; **Smallest → Largest** sorts numbers.
- Use **Custom Sort** to sort by more than one column — for example by *Region* and then by *Sales* from largest to smallest.

> [!WARNING]
> Never select just one column and sort it — the rest of the row stays behind and your data gets scrambled. Click one cell inside the table, or select the whole table, then sort.

### Filtering
**Data → Filter** (or `Ctrl + Shift + L`) adds drop-down arrows to each header. You can:

- tick only the values you want to see (e.g. only "Kumasi"),
- use **Number Filters** such as *Greater Than 1000* or *Top 10*,
- use **Text Filters** such as *Contains "rice"*,
- filter by colour.

Filtering **hides** rows; it doesn't delete them. The row numbers turn blue to remind you. Clear the filter to see everything again.

### SUBTOTAL for filtered data
`SUM` adds hidden rows too. To total only the *visible* rows after filtering, use:

```
=SUBTOTAL(9, D2:D500)
```

(9 means SUM; 1 means AVERAGE; 3 means COUNTA.)

> [!TRY]
> Using a sales table, filter to show only one region, then use SUBTOTAL to show that region's total sales.

## Lesson: Cleaning messy data (10 min)
Real-world data is messy: extra spaces, inconsistent spelling, duplicates and numbers stored as text. Analysts often spend most of their time cleaning. Clean data = trustworthy results.

### Common problems and fixes
| Problem | Example | Fix |
|---|---|---|
| Extra spaces | `" Accra "` | `=TRIM(A2)` |
| Inconsistent capitals | `accra`, `ACCRA` | `=PROPER(A2)` → `Accra` |
| Joined data | `Mensah, Kofi` | **Data → Text to Columns** split by comma |
| Separate first & last names | `Kofi` + `Mensah` | `=A2&" "&B2` or `=TEXTJOIN(" ",TRUE,A2,B2)` |
| Duplicate rows | same sale entered twice | **Data → Remove Duplicates** |
| Numbers as text | `'250` | `=VALUE(A2)` or *Convert to Number* |
| Spelling variations | `Kumasi`, `Kumase` | Find & Replace (`Ctrl + H`) |

### Text functions worth knowing
- `=LEFT(A2, 3)` — first 3 characters (e.g. a product code prefix)
- `=RIGHT(A2, 4)` — last 4 characters
- `=LEN(A2)` — number of characters (find phone numbers with the wrong length!)
- `=UPPER(A2)` / `=LOWER(A2)`

### Work on a copy
Always keep the original raw data on its own sheet. Do your cleaning in new columns or a copy. Then if something goes wrong, you can start again.

> [!TIP]
> After cleaning with formulas, **Copy → Paste Special → Values** to replace formulas with their results before deleting the original columns.

> [!TRY]
> Type a list of 10 town names with mixed capitals and extra spaces. Use `=PROPER(TRIM(A2))` to clean them all in one step.

## Lesson: Data validation and conditional formatting (9 min)
Prevent mistakes before they happen, and make important values stand out.

### Data validation: control what people can type
Select a range and go to **Data → Data Validation**.

- **List** — create a drop-down (e.g. `Paid, Unpaid, Partial`). This stops spelling variations.
- **Whole number between** 0 and 100 — perfect for test scores.
- **Date** after a certain day.
- Add an **input message** to guide users and an **error alert** to block wrong entries.

Drop-down lists are one of the simplest ways to keep shared spreadsheets clean.

### Conditional formatting: let colour tell the story
**Home → Conditional Formatting** changes a cell's look based on its value.

- **Highlight Cells Rules** — e.g. scores below 50 in red.
- **Top/Bottom Rules** — highlight the top 10%.
- **Data Bars** — mini bar charts inside cells.
- **Color Scales** — green-to-red heat maps.
- **Icon Sets** — arrows or traffic lights.

You can also use a formula rule. To highlight the whole row of any student who failed, select the table and use the rule:

```
=$E2="Fail"
```

The `$` locks column E, so every column in the row checks the same Status cell.

> [!WARNING]
> Don't overuse colour. If everything is highlighted, nothing stands out. Choose one or two rules that answer a real question.

> [!TRY]
> Add a drop-down list to a "Payment status" column and use conditional formatting to colour "Unpaid" rows light red.

## Quiz: Module 3 quiz — Organising data {pass=70}
### Q: You need to total only the rows visible after filtering. Which function should you use?
- [ ] SUM
- [x] SUBTOTAL
- [ ] COUNTIF
- [ ] TOTAL
> SUBTOTAL ignores rows hidden by a filter; SUM includes them.

### Q: Which formula turns "  kOFI mensah " into "Kofi Mensah"?
- [ ] =TRIM(UPPER(A2))
- [x] =PROPER(TRIM(A2))
- [ ] =LEFT(A2, 11)
- [ ] =CLEAN(A2)
> TRIM removes extra spaces and PROPER capitalises each word.

### Q(tf): Filtering a table permanently deletes the rows you don't see.
= false
> Filtering only hides rows. Clearing the filter shows them again.

### Q: What is the best way to stop people typing "paid", "Paid " and "PAID" in the same column?
- [ ] Ask them nicely
- [x] Use data validation with a drop-down list
- [ ] Use bold text
- [ ] Freeze the column
> A validation list allows only the exact options you define.

### Q: Why should you click a single cell inside a table rather than select one column before sorting?
- [ ] It sorts faster
- [x] So entire rows move together and data isn't scrambled
- [ ] Because sorting only works on one cell
- [ ] To keep the formatting
> Sorting one column alone separates values from the rest of their row.

# Module: Analysing and presenting data
Turn tables into insight with PivotTables, charts and dashboards.

## Lesson: PivotTables — summaries in seconds (11 min)
A **PivotTable** summarises thousands of rows without a single formula. It is the most powerful tool most people never learn — and employers love it.

### When to use one
You have a sales table with columns **Date, Region, Product, Salesperson, Amount**. You want to know:
- total sales per region,
- which product sells best in each region,
- monthly sales trends.

### Creating a PivotTable
1. Click any cell inside your table.
2. **Insert → PivotTable** (Google Sheets: **Insert → Pivot table**).
3. Choose **New Worksheet** and click OK.
4. In the field list, drag fields into four areas:

| Area | What it does | Example |
|---|---|---|
| **Rows** | Categories down the side | Region |
| **Columns** | Categories across the top | Product |
| **Values** | Numbers to summarise | Sum of Amount |
| **Filters** | Filter the whole report | Salesperson |

Instantly you get a grid of total sales for each region and product.

### Useful tricks
- Click the Values field → **Value Field Settings** to switch between Sum, Count, Average, Max.
- Right-click a date in Rows → **Group** → *Months* to see monthly totals.
- **Show Values As → % of Grand Total** shows each region's share.
- When the source data changes, right-click the PivotTable → **Refresh**.

> [!TIP]
> Format your source data as a Table (`Ctrl + T`) before creating the PivotTable. New rows you add later will be included automatically when you refresh.

> [!TRY]
> Create a sales table with at least 20 rows (Region, Product, Amount). Build a PivotTable showing total sales per region, then add Product to Columns.

## Lesson: Choosing and building the right chart (10 min)
A good chart shows the answer at a glance. A bad chart confuses. The secret is choosing the right type for your question.

### Pick the chart for the question
| Question | Best chart |
|---|---|
| How do categories compare? | **Column** or **bar** chart |
| How has something changed over time? | **Line** chart |
| What share does each part make up of a whole? (few parts) | **Pie** or **doughnut** chart |
| Is there a relationship between two numbers? | **Scatter** chart |
| What is the distribution of values? | **Histogram** |

Use a **bar** chart (horizontal) when category names are long, such as school names.

### Building a chart
1. Select your data including headers.
2. **Insert → Recommended Charts** (or choose a type).
3. Add a clear **chart title** that states the insight, e.g. "Kumasi had the highest sales in March".
4. Label the axes and remove clutter (heavy gridlines, 3-D effects, unnecessary legends).

### Design rules for honest charts
- Start bar and column charts at **zero** — otherwise small differences look huge.
- Use **one highlight colour** for the bar you want people to notice and grey for the rest.
- Sort bars from largest to smallest unless there's a natural order (like months).
- Avoid pie charts with more than five slices.

> [!WARNING]
> 3-D charts look impressive but distort sizes and make values harder to read. Professionals avoid them.

> [!TRY]
> From your PivotTable, insert a column chart of sales by region. Give it a title that tells the reader the main finding.

## Lesson: Project — build a personal budget dashboard (12 min)
Let's combine everything into a practical tool: a monthly budget in Ghana cedis.

### Step 1: The transactions sheet
Create a sheet called **Transactions** with columns:

`Date | Description | Category | Type | Amount (GH₵)`

- **Category:** use a drop-down list — *Food, Transport, Data & airtime, School, Savings, Rent, Other*.
- **Type:** a drop-down with *Income* or *Expense*.
- Format it as a Table and enter at least 15 transactions.

### Step 2: The summary sheet
On a sheet called **Summary**:

```
Total income     =SUMIFS(Transactions[Amount (GH₵)], Transactions[Type], "Income")
Total expenses   =SUMIFS(Transactions[Amount (GH₵)], Transactions[Type], "Expense")
Balance          =B1-B2
Savings rate     =IF(B1=0, 0, B4/B1)
```

(If you didn't format as a Table, use normal ranges like `E2:E200`.)

Then list each category in column A and calculate spending per category with SUMIFS.

### Step 3: Make it visual
- Add a **bar chart** of spending by category, sorted largest to smallest.
- Use **conditional formatting** to turn the Balance cell red if it is below zero.
- Add a cell that says `=IF(B3<0, "⚠ Overspending!", "✓ On track")`.

### Step 4: Reflect
Look at your biggest category. Is there one change that could help you save GH₵50 next month? This is exactly how analysts work: **data → insight → action**.

> [!TIP]
> In Google Sheets you can share the budget with a family member and edit it together — and use it offline on your phone.

> [!TRY]
> Complete the dashboard and save it in your `DBI Learn/Projects` folder. It's a great example to show in an interview.

## Quiz: Module 4 quiz — Analysis and charts {pass=70}
### Q: Which chart is best for showing how monthly sales changed over a year?
- [ ] Pie chart
- [x] Line chart
- [ ] Scatter chart
- [ ] Doughnut chart
> Line charts show change over time clearly.

### Q: In a PivotTable, where would you put "Amount" to see total sales?
- [ ] Rows
- [ ] Columns
- [x] Values
- [ ] Filters
> Numeric fields go in Values, where they are summed, counted or averaged.

### Q(tf): After you change the source data, a PivotTable updates automatically without refreshing.
= false
> PivotTables must be refreshed (right-click → Refresh) to pick up changes.

### Q(multiple): Which are good chart design practices?
- [x] Start column charts at zero
- [x] Use a title that states the key finding
- [ ] Use 3-D effects to look professional
- [ ] Put 12 slices in a pie chart
> Honest axes and clear titles help readers; 3-D and crowded pies make charts harder to read.

### Q: What does the formula `=IF(B1=0, 0, B4/B1)` protect against?
- [ ] Negative balances
- [x] Dividing by zero when there is no income
- [ ] Spelling mistakes
- [ ] Too many decimal places
> Dividing by zero causes a #DIV/0! error; the IF returns 0 instead.

# Final: Final exam — Spreadsheets & Data Analysis {pass=70 attempts=3 time=30}
### Q: A formula `=C2*$F$1` is copied from row 2 to row 10. What does it become?
- [x] =C10*$F$1
- [ ] =C10*$F$10
- [ ] =C2*$F$1
- [ ] =C10*F10
> C2 is relative and moves to C10; $F$1 is absolute and stays fixed.

### Q: Which function returns the number of non-empty cells, including text?
- [ ] COUNT
- [x] COUNTA
- [ ] COUNTBLANK
- [ ] SUM
> COUNTA counts any non-empty cell.

### Q: Which formula adds the Amount (column D) for rows where Region (column C) is "Tamale"?
- [x] =SUMIF(C2:C500, "Tamale", D2:D500)
- [ ] =SUMIF(D2:D500, "Tamale", C2:C500)
- [ ] =COUNTIF(C2:C500, "Tamale")
- [ ] =SUM(C2:C500="Tamale")
> SUMIF(range to check, criteria, range to add).

### Q: What will `=IFS(B2>=80,"A", B2>=60,"B", TRUE,"C")` return if B2 is 65?
- [ ] A
- [x] B
- [ ] C
- [ ] TRUE
> 65 is not ≥ 80, but it is ≥ 60, so the result is "B".

### Q: XLOOKUP returns "Not found" even though you can see the product in the list. What is the most likely cause?
- [ ] The spreadsheet is broken
- [x] Extra spaces or different spelling in one of the values
- [ ] XLOOKUP only works with numbers
- [ ] The list is too long
> Hidden spaces or spelling differences stop exact matches. TRIM fixes spaces.

### Q(multiple): Which actions help clean messy data?
- [x] TRIM to remove extra spaces
- [x] Remove Duplicates
- [x] Text to Columns to split combined values
- [ ] Merging cells in the middle of the table
> Merging cells breaks sorting and filtering; the others clean data.

### Q: Which tool summarises total sales by region and product without writing formulas?
- [ ] Data validation
- [ ] Conditional formatting
- [x] PivotTable
- [ ] Flash Fill
> PivotTables group and summarise data by dragging fields.

### Q: Which chart best compares the total enrolment of 8 schools with long names?
- [ ] Pie chart
- [ ] Line chart
- [x] Horizontal bar chart
- [ ] Scatter chart
> Bar charts compare categories, and horizontal bars give room for long labels.

### Q(tf): Conditional formatting can highlight an entire row based on the value in one column.
= true
> Use a formula rule such as `=$E2="Fail"` with the column locked.

### Q: In Excel, which shortcut quickly inserts a SUM below a column of numbers?
- [ ] Ctrl + S
- [x] Alt + =
- [ ] Ctrl + Shift + S
- [ ] F4
> Alt + = inserts AutoSum.

### Q(short): Which symbol must every formula start with?
= = | equals | equal sign | equals sign | the equals sign
> All formulas begin with an equals sign (=).

### Q: You divide total savings by total income, but income is 0 and you see #DIV/0!. Which is the best fix?
- [ ] Delete the formula
- [x] =IF(income=0, 0, savings/income)
- [ ] Format the cell as text
- [ ] Use a bigger font
> Checking for zero first prevents the error.
