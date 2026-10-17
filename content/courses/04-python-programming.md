---
slug: python-programming-beginners
title: Python Programming for Beginners
subtitle: Learn to think like a programmer and write real Python programs — from your first print statement to a working mini-project.
category: software-development
level: beginner
hours: 12
featured: false
tags: [python, programming, coding, algorithms, problem solving]
outcomes:
  - Write, run and debug Python programs
  - Use variables, data types, input and output
  - Control program flow with conditions and loops
  - Organise code with functions and store data in lists and dictionaries
  - Read and handle errors calmly and fix bugs systematically
  - Build a complete command-line project such as a quiz game or budget tracker
requirements:
  - Basic computer skills
  - Python 3 installed, or a free online editor such as Programiz (link in the Resource library)
description: |
  Python is one of the world's most popular programming languages. It's used by Google, NASA, banks, data scientists and AI researchers — and it is famously easy to read, which makes it perfect as a first language.

  In this course you will learn the core ideas of programming that apply to every language: variables, decisions, loops, functions and data structures. Every lesson has short examples you can run immediately, and the course ends with a project you can show off. Think of it as learning to give clear instructions to a very fast, very literal assistant.
---

# Module: Getting started with Python
Understand what programming is, run your first program and work with variables.

## Lesson: What is programming? (8 min)
A **program** is a list of instructions that a computer follows exactly. **Programming** (or *coding*) is the skill of writing those instructions in a language the computer understands.

Computers are fast but extremely literal. If you tell a friend "make tea", they know what to do. A computer needs every step: boil water, put tea bag in cup, pour water, wait three minutes, remove bag. Breaking a problem into precise steps is called an **algorithm**, and it's the heart of programming.

### Why Python?
- **Readable** — Python code looks almost like English.
- **Versatile** — websites, data analysis, automation, games, artificial intelligence.
- **In demand** — one of the most requested skills in tech job adverts.
- **Free** — and runs on Windows, Mac, Linux and even Android.

### How Python runs your code
You write code in a file ending in `.py`. The **Python interpreter** reads it line by line, from top to bottom, and carries out each instruction.

### Setting up
**Option 1 — online (no installation):** open an online Python editor such as Programiz, type code on the left and press **Run**.

**Option 2 — on your computer:**
1. Download Python 3 from python.org and install it. On Windows, tick **"Add Python to PATH"**.
2. Install **VS Code** and the Python extension.
3. Create a file `hello.py`, write your code, and run it with the ▶ button or by typing `python hello.py` in the terminal.

> [!TIP]
> On an Android phone, apps such as Pydroid 3 let you write and run Python offline.

> [!TRY]
> Write the steps of an algorithm for "sending a mobile money payment" in plain English. Be as precise as a computer would need.

## Lesson: Your first program: print and comments (9 min)
Tradition says every programmer's first program prints a greeting:

```python
print("Hello, world!")
```

Run it, and you'll see `Hello, world!` in the output. Congratulations — you're a programmer!

### The print function
`print()` displays whatever you put inside the brackets.

```python
print("Welcome to DBI Learn")
print("I am learning Python")
print(5 + 3)
print("Total:", 250)
```

Output:
```
Welcome to DBI Learn
I am learning Python
8
Total: 250
```

- Text must be inside quotes — single `'...'` or double `"..."`. Text in quotes is called a **string**.
- Numbers don't need quotes, and Python can calculate with them.
- Commas let you print several things separated by a space.

### Comments
Lines starting with `#` are **comments** — notes for humans that Python ignores.

```python
# This program greets the user
print("Akwaaba!")  # "Welcome" in Twi
```

Good comments explain *why* you did something, not what is obvious.

### Errors are normal
If you write `print("Hello)` (missing a quote), Python shows a **SyntaxError**. Read the message — it tells you the line number and what went wrong. Every programmer sees errors every day; fixing them is part of the job.

> [!TIP]
> Python is **case-sensitive**: `print` works, `Print` does not.

> [!TRY]
> Write a program that prints your name, your school and your favourite food on three separate lines, with a comment at the top explaining what it does.

## Lesson: Variables and data types (10 min)
A **variable** is a named box that stores a value so you can use it later.

```python
name = "Esi"
age = 16
height = 1.62
is_student = True

print(name, "is", age, "years old")
```

The `=` sign means **assign** — "put this value in this box". It is not the same as "equals" in maths.

### The main data types
| Type | Name | Examples |
|---|---|---|
| `str` | string (text) | `"Accra"`, `'Hello'` |
| `int` | integer (whole number) | `25`, `-3`, `0` |
| `float` | decimal number | `3.14`, `12.5` |
| `bool` | Boolean | `True`, `False` |

Use `type()` to check: `print(type(age))` shows `<class 'int'>`.

### Naming rules
- Use letters, numbers and underscores, but don't start with a number.
- No spaces: use `first_name`, not `first name`.
- Choose meaningful names: `price_per_bag` is better than `x`.
- Python style uses **snake_case** (lowercase with underscores).

### Doing maths
```python
price = 12.5
quantity = 4
total = price * quantity     # 50.0

print(10 / 3)    # 3.333...  division
print(10 // 3)   # 3          whole-number division
print(10 % 3)    # 1          remainder (modulo)
print(2 ** 5)    # 32         power
```

### Working with strings
```python
first = "Kwame"
last = "Mensah"
full = first + " " + last            # joining strings
print(full.upper())                   # KWAME MENSAH
print(len(full))                      # 12 characters
print(f"Welcome, {first}!")           # f-string: Welcome, Kwame!
```

**f-strings** (put `f` before the quote) let you insert variables inside `{}` — the cleanest way to build messages.

> [!TRY]
> Create variables for an item name, its price in cedis and the quantity. Calculate the total and print a receipt line using an f-string, e.g. `3 x Bread = GH₵ 24.0`.

## Quiz: Practice — Python basics {kind=practice pass=60}
### Q: What does `print(7 % 3)` display?
- [ ] 2.33
- [x] 1
- [ ] 2
- [ ] 21
> `%` gives the remainder: 7 divided by 3 is 2 remainder 1.

### Q(tf): In Python, `Print("Hi")` works exactly the same as `print("Hi")`.
= false
> Python is case-sensitive, so `Print` is not recognised.

### Q: Which is a valid variable name?
- [ ] 2nd_place
- [ ] first name
- [x] first_name
- [ ] first-name
> Variable names can't start with a number or contain spaces or hyphens.

## Quiz: Module 1 quiz — Getting started {pass=70}
### Q: What is an algorithm?
- [ ] A type of computer
- [x] A precise, step-by-step set of instructions to solve a problem
- [ ] A Python error message
- [ ] A programming language
> Algorithms are the step-by-step logic behind every program.

### Q: What data type is the value `3.5`?
- [ ] int
- [x] float
- [ ] str
- [ ] bool
> Numbers with a decimal point are floats.

### Q: What will this print?
```python
name = "Ama"
print(f"Hello, {name}!")
```
- [ ] Hello, {name}!
- [x] Hello, Ama!
- [ ] Hello, name!
- [ ] An error
> f-strings replace `{name}` with the value of the variable.

### Q(multiple): Which lines will Python ignore when running?
- [x] `# Calculate the total`
- [ ] `total = 5 + 3`
- [x] `   # indented comment`
- [ ] `print("# not a comment")`
> Lines starting with # (even indented) are comments. A # inside a string is just text.

### Q(short): What is the result of `10 // 3` in Python?
= 3
> `//` is whole-number (floor) division.

# Module: Making decisions and repeating actions
Teach your programs to make choices and repeat work automatically.

## Lesson: Getting input from the user (8 min)
Programs become interactive when they ask the user for information. The `input()` function shows a message and waits for the user to type something.

```python
name = input("What is your name? ")
print(f"Nice to meet you, {name}!")
```

### input() always returns a string
This catches every beginner out:

```python
age = input("How old are you? ")
print(age + 1)     # TypeError! You can't add a number to a string
```

Convert the input to the type you need:

```python
age = int(input("How old are you? "))
print(f"Next year you will be {age + 1}")

price = float(input("Price in cedis: "))
```

- `int()` converts to a whole number.
- `float()` converts to a decimal.
- `str()` converts a number to text.

### A simple calculator
```python
print("=== Simple shop calculator ===")
item = input("Item: ")
price = float(input("Price per unit (GH₵): "))
qty = int(input("Quantity: "))
total = price * qty
print(f"{qty} x {item} = GH₵ {total:.2f}")
```

`{total:.2f}` formats the number with exactly two decimal places — perfect for money.

> [!WARNING]
> If the user types "ten" instead of "10", `int()` crashes with a ValueError. We'll learn to handle this gracefully in Module 4.

> [!TRY]
> Write a program that asks for the length and width of a room in metres and prints its area with two decimal places.

## Lesson: Conditions with if, elif and else (10 min)
Programs often need to choose between options. Python uses `if`, `elif` (else if) and `else`.

```python
score = int(input("Enter your score: "))

if score >= 50:
    print("You passed! 🎉")
else:
    print("Keep practising — you'll get there.")
```

### Indentation matters
The lines that belong to an `if` must be **indented** (4 spaces is standard). Python uses indentation instead of brackets to group code. Wrong indentation causes an `IndentationError` or, worse, a program that runs but does the wrong thing.

### Comparison operators
`==` equal to, `!=` not equal to, `>`, `<`, `>=`, `<=`

> [!WARNING]
> `=` assigns a value; `==` compares two values. Writing `if score = 50:` is an error.

### Multiple choices with elif
```python
if score >= 80:
    grade = "A"
elif score >= 70:
    grade = "B"
elif score >= 60:
    grade = "C"
elif score >= 50:
    grade = "D"
else:
    grade = "F"
print(f"Your grade is {grade}")
```

Python checks each condition in order and runs only the **first** one that is true.

### Combining conditions
- `and` — both must be true
- `or` — at least one must be true
- `not` — reverses True/False

```python
age = 17
has_permission = True

if age >= 18 or has_permission:
    print("You can join the trip.")
```

> [!TRY]
> Write a program that asks for a temperature in °C and prints "Hot" (above 30), "Warm" (20–30) or "Cool" (below 20).

## Lesson: Loops with for and while (11 min)
Loops repeat code so you don't have to write it many times.

### for loops — repeat a set number of times
```python
for i in range(5):
    print("Practice makes progress!")
```

`range(5)` produces the numbers 0, 1, 2, 3, 4. Variations:

```python
for n in range(1, 11):        # 1 to 10
    print(n, "x 7 =", n * 7)  # the 7 times table

for n in range(0, 101, 10):   # 0, 10, 20 ... 100
    print(n)
```

### Looping over text and lists
```python
for letter in "DBI":
    print(letter)

towns = ["Accra", "Kumasi", "Tamale", "Ho"]
for town in towns:
    print(f"Hello, {town}!")
```

### while loops — repeat until a condition changes
```python
balance = 100
while balance > 0:
    print(f"Balance: GH₵ {balance}")
    balance = balance - 30
print("Out of money!")
```

A `while` loop is useful when you don't know in advance how many times to repeat, such as "keep asking until the user types the right password".

```python
password = ""
while password != "akwaaba":
    password = input("Password: ")
print("Access granted")
```

> [!WARNING]
> If the condition never becomes false, you get an **infinite loop** that runs forever. Make sure something inside the loop changes the condition. Press `Ctrl + C` to stop a runaway program.

### break and continue
- `break` exits the loop immediately.
- `continue` skips to the next repetition.

### Building a total with a loop
```python
total = 0
for day in range(1, 8):
    sales = float(input(f"Sales on day {day}: "))
    total += sales          # same as total = total + sales
print(f"Weekly sales: GH₵ {total:.2f}")
```

> [!TRY]
> Write a program that prints the multiplication table for any number the user chooses, from 1 to 12.

## Quiz: Module 2 quiz — Decisions and loops {pass=70}
### Q: What does `input()` always return?
- [ ] An integer
- [ ] A float
- [x] A string
- [ ] It depends on what the user types
> input() returns text; convert it with int() or float() when you need a number.

### Q: Which numbers does `range(1, 5)` produce?
- [ ] 1, 2, 3, 4, 5
- [x] 1, 2, 3, 4
- [ ] 0, 1, 2, 3, 4
- [ ] 5 numbers starting at 0
> range stops just before the end value.

### Q: What will this print?
```python
x = 7
if x > 10:
    print("big")
elif x > 5:
    print("medium")
else:
    print("small")
```
- [ ] big
- [x] medium
- [ ] small
- [ ] medium and small
> Only the first true branch runs: 7 > 5.

### Q(tf): A while loop whose condition never becomes false will run forever.
= true
> That is an infinite loop. Something inside the loop must change the condition.

### Q(short): Which keyword immediately exits a loop?
= break
> `break` stops the loop; `continue` skips to the next repetition.

# Module: Functions and data structures
Organise your code into reusable functions and store collections of data.

## Lesson: Writing your own functions (10 min)
A **function** is a named block of code that does one job. You've already used built-in functions like `print()`, `input()` and `len()`. Now you'll write your own.

```python
def greet(name):
    print(f"Akwaaba, {name}! Welcome to DBI Learn.")

greet("Yaw")
greet("Abena")
```

- `def` starts the definition.
- `name` is a **parameter** — a placeholder for the value you pass in.
- `"Yaw"` is an **argument** — the actual value.
- The indented lines are the function's **body**.

### Returning values
Use `return` to send a result back:

```python
def calculate_total(price, quantity):
    return price * quantity

bill = calculate_total(12.5, 4)
print(bill)   # 50.0
```

A function that returns a value can be used in calculations, `if` statements and other functions.

### Default parameters
```python
def add_vat(amount, rate=0.15):
    return amount * (1 + rate)

print(add_vat(100))         # 115.0 (uses the default 15%)
print(add_vat(100, 0.2))    # 120.0
```

### Why functions matter
- **Reuse** — write once, use many times.
- **Readability** — `calculate_total(...)` explains itself.
- **Testing** — check one small piece at a time.
- **Fewer bugs** — fix a problem in one place.

A good rule: if you copy and paste the same code three times, turn it into a function.

> [!TIP]
> Variables created inside a function exist only inside it (this is called **local scope**). To get a value out, `return` it.

> [!TRY]
> Write a function `grade(score)` that returns "A", "B", "C", "D" or "F", then call it for five different scores.

## Lesson: Lists — storing many values (10 min)
A **list** stores an ordered collection of items in a single variable.

```python
subjects = ["Maths", "English", "Science", "ICT"]
scores = [78, 64, 85, 92]
```

### Accessing items by index
Python counts from **0**:

```python
print(subjects[0])     # Maths
print(subjects[2])     # Science
print(subjects[-1])    # ICT (negative counts from the end)
print(subjects[1:3])   # ['English', 'Science'] — a slice
```

### Changing lists
```python
subjects.append("French")       # add to the end
subjects.insert(1, "Twi")       # insert at position 1
subjects.remove("English")      # remove by value
last = subjects.pop()           # remove and return the last item
subjects[0] = "Mathematics"     # replace an item
```

### Useful list functions
```python
scores = [78, 64, 85, 92]
print(len(scores))              # 4
print(sum(scores))              # 319
print(max(scores), min(scores)) # 92 64
print(sum(scores) / len(scores))# average: 79.75
scores.sort()                   # [64, 78, 85, 92]
print(85 in scores)             # True
```

### Looping through a list
```python
for subject, score in zip(subjects, scores):
    print(f"{subject}: {score}")
```

Or with positions using `enumerate`:

```python
for i, subject in enumerate(subjects, start=1):
    print(i, subject)
```

> [!TRY]
> Ask the user for five test scores, store them in a list with `append`, then print the highest, lowest and average score.

## Lesson: Dictionaries — data with labels (10 min)
A **dictionary** stores **key–value pairs**, like a real dictionary stores words and their meanings.

```python
student = {
    "name": "Kofi Asante",
    "age": 15,
    "school": "Ayeldu JHS",
    "subjects": ["Maths", "ICT"],
}

print(student["name"])          # Kofi Asante
student["age"] = 16             # update
student["email"] = "kofi@example.com"   # add a new key
```

### Safe lookups
`student["phone"]` crashes with a **KeyError** if the key doesn't exist. Use `.get()` to provide a default:

```python
phone = student.get("phone", "Not provided")
```

### Looping through a dictionary
```python
prices = {"rice": 45.0, "oil": 38.5, "sugar": 22.0}

for item, price in prices.items():
    print(f"{item.title()}: GH₵ {price:.2f}")
```

### Lists of dictionaries — real-world data
Most real data looks like a list of records:

```python
students = [
    {"name": "Ama", "score": 82},
    {"name": "Kojo", "score": 67},
    {"name": "Efua", "score": 91},
]

for s in students:
    status = "Pass" if s["score"] >= 50 else "Fail"
    print(f"{s['name']}: {s['score']} ({status})")

best = max(students, key=lambda s: s["score"])
print("Top student:", best["name"])
```

This is exactly how data from websites and apps (JSON) is structured.

### Choosing the right structure
- **List** — an ordered collection of similar items (scores, names).
- **Dictionary** — labelled information about one thing (a student's details), or a lookup table (prices).

> [!TRY]
> Create a dictionary of five products and their prices. Ask the user for a product name and print its price, or "Sorry, we don't sell that" if it isn't there.

## Quiz: Module 3 quiz — Functions and data {pass=70}
### Q: What keyword sends a value back from a function?
- [ ] send
- [ ] print
- [x] return
- [ ] give
> `return` passes a result back to the code that called the function.

### Q: Given `colours = ["red", "green", "blue"]`, what is `colours[1]`?
- [ ] red
- [x] green
- [ ] blue
- [ ] An error
> Indexes start at 0, so index 1 is the second item.

### Q: Which line safely gets a value from a dictionary, returning "N/A" if the key is missing?
- [ ] d["phone"]
- [x] d.get("phone", "N/A")
- [ ] d.find("phone")
- [ ] d["phone"] or "N/A"
> `.get()` avoids a KeyError and returns the default.

### Q(multiple): Which statements about functions are true?
- [x] They help you reuse code
- [x] They can take parameters
- [ ] They must always print something
- [x] Variables created inside them are local
> Functions don't have to print — they often return values instead.

### Q(short): What does `len([4, 8, 15, 16])` return?
= 4
> len counts the items in the list.

# Module: Debugging and your final project
Handle errors, debug like a pro and build a complete program.

## Lesson: Understanding and handling errors (10 min)
Errors aren't failures — they're messages telling you what to fix.

### Reading an error message (traceback)
```
Traceback (most recent call last):
  File "shop.py", line 4, in <module>
    total = price * qty
NameError: name 'qty' is not defined
```

Read from the **bottom up**: the last line tells you the error type and message; the line above shows where it happened.

### Common errors
| Error | Meaning | Typical fix |
|---|---|---|
| `SyntaxError` | Python can't understand the code | Check brackets, quotes and colons |
| `IndentationError` | Wrong spacing | Use 4 spaces consistently |
| `NameError` | A variable doesn't exist | Check spelling; define it first |
| `TypeError` | Wrong type, e.g. `"5" + 3` | Convert with `int()` or `str()` |
| `ValueError` | Right type, bad value, e.g. `int("ten")` | Validate input |
| `IndexError` | List position doesn't exist | Check the list length |
| `KeyError` | Dictionary key doesn't exist | Use `.get()` |
| `ZeroDivisionError` | Dividing by zero | Check before dividing |

### Handling errors with try / except
```python
try:
    age = int(input("Your age: "))
    print(f"In 10 years you'll be {age + 10}")
except ValueError:
    print("Please enter your age as a number, e.g. 16")
```

Python *tries* the code; if a `ValueError` happens, it runs the `except` block instead of crashing.

### Keep asking until the input is valid
```python
while True:
    try:
        qty = int(input("Quantity: "))
        if qty > 0:
            break
        print("Quantity must be more than zero.")
    except ValueError:
        print("That's not a whole number. Try again.")
```

> [!TIP]
> Catch specific errors (`except ValueError:`) rather than everything (`except:`). Catching everything hides real bugs.

> [!TRY]
> Update your shop calculator so it never crashes, no matter what the user types.

## Lesson: Debugging strategies (8 min)
Professional developers spend a lot of time **debugging** — finding and fixing problems. Here's a calm, systematic approach.

### 1. Reproduce the bug
Find the exact steps and inputs that cause the problem. If you can't make it happen reliably, you can't be sure you've fixed it.

### 2. Read the error message
Note the error type and line number. Search the exact message online — someone has almost certainly had the same problem.

### 3. Print what's happening
Add temporary `print()` lines to see the values of variables:

```python
for item in cart:
    print("DEBUG item =", item)      # what is actually in the list?
    total += item["price"] * item["qty"]
```

Often the value isn't what you expected — a string instead of a number, or an empty list.

### 4. Shrink the problem
Comment out parts of the code, or copy the suspicious part into a small new file. The smaller the code, the easier it is to see the bug.

### 5. Rubber duck debugging
Explain your code, line by line, out loud to someone — or to a rubber duck! Saying it aloud often makes the mistake obvious.

### 6. Fix one thing at a time and test again
Change one thing, run the program, and check. Changing many things at once makes it hard to know what worked.

### Logic errors
The hardest bugs produce no error at all — the program runs but gives the wrong answer. For example, using `>` instead of `>=` means a score of exactly 50 fails. Test with **edge cases**: 0, negative numbers, empty input, the exact boundary values.

> [!TRY]
> This code should print the average but doesn't. Find the bug:
> `scores = [70, 80, 90]` then `average = sum(scores) / 2`.

## Lesson: Project — build a quiz game (14 min)
Let's combine everything into a complete program: a multiple-choice quiz game with scoring.

### Plan first
1. Store questions, options and answers in a list of dictionaries.
2. Loop through the questions, show options, get the user's answer.
3. Validate input (only a, b, c or d).
4. Keep score and give feedback.
5. Show a final result and a grade.

### The code
```python
# DBI Learn — Python Quiz Game

QUESTIONS = [
    {
        "question": "What is the capital of Ghana?",
        "options": {"a": "Kumasi", "b": "Accra", "c": "Tamale", "d": "Cape Coast"},
        "answer": "b",
    },
    {
        "question": "Which data type stores True or False?",
        "options": {"a": "int", "b": "str", "c": "bool", "d": "float"},
        "answer": "c",
    },
    {
        "question": "What does len('DBI') return?",
        "options": {"a": "2", "b": "3", "c": "4", "d": "DBI"},
        "answer": "b",
    },
]


def ask(q):
    """Show one question and return True if answered correctly."""
    print("\n" + q["question"])
    for letter, text in q["options"].items():
        print(f"  {letter}) {text}")

    while True:
        choice = input("Your answer (a/b/c/d): ").strip().lower()
        if choice in q["options"]:
            break
        print("Please type a, b, c or d.")

    if choice == q["answer"]:
        print("✅ Correct!")
        return True
    correct_text = q["options"][q["answer"]]
    print(f"❌ Not quite. The answer is {q['answer']}) {correct_text}")
    return False


def grade(percent):
    if percent >= 80:
        return "Excellent!"
    if percent >= 50:
        return "Good job!"
    return "Keep practising!"


def main():
    print("=== Welcome to the DBI Quiz ===")
    name = input("What's your name? ").strip() or "Learner"
    score = 0
    for q in QUESTIONS:
        if ask(q):
            score += 1
    percent = round(score / len(QUESTIONS) * 100)
    print(f"\n{name}, you scored {score}/{len(QUESTIONS)} ({percent}%). {grade(percent)}")


main()
```

### Make it your own
- Add at least five more questions on a topic you love.
- Shuffle the questions with `import random` and `random.shuffle(QUESTIONS)`.
- Add a timer using `import time` and `time.time()`.
- Ask "Play again? (y/n)" at the end using a `while` loop.

> [!TIP]
> Notice how each function does one job. This makes the program easy to read, test and extend — the mark of a good programmer.

> [!TRY]
> Complete the quiz game with 10 questions and one extra feature. Share your code in the course discussion!

## Quiz: Module 4 quiz — Errors and projects {pass=70}
### Q: Which error does `int("ten")` raise?
- [ ] TypeError
- [x] ValueError
- [ ] NameError
- [ ] SyntaxError
> The type (string) is acceptable to int(), but the value can't be converted, so it's a ValueError.

### Q: When reading a traceback, where should you look first?
- [ ] The first line
- [x] The last line, which names the error
- [ ] The middle line
- [ ] Nowhere — just retry
> The final line gives the error type and message; the lines above show where it happened.

### Q: What does this code print if the user types "abc"?
```python
try:
    n = int(input())
    print("ok")
except ValueError:
    print("invalid")
```
- [ ] ok
- [x] invalid
- [ ] The program crashes
- [ ] abc
> int("abc") raises ValueError, so the except block runs.

### Q(multiple): Which are good debugging habits?
- [x] Reproduce the bug reliably first
- [x] Print variable values to see what's happening
- [x] Change one thing at a time and test again
- [ ] Rewrite the whole program immediately
> Systematic, small steps find bugs fastest.

### Q(tf): A logic error always produces a red error message.
= false
> Logic errors run without crashing but give wrong results — that's why testing edge cases matters.

# Final: Final exam — Python Programming for Beginners {pass=70 attempts=3 time=35}
### Q: What will this code print?
```python
x = 5
x = x + 3
print(x * 2)
```
- [ ] 10
- [x] 16
- [ ] 13
- [ ] 53
> x becomes 8, and 8 × 2 = 16.

### Q: What is the type of `"25"`?
- [ ] int
- [ ] float
- [x] str
- [ ] bool
> Anything in quotes is a string, even if it looks like a number.

### Q: Which line correctly converts user input to a whole number?
- [ ] age = input(int("Age: "))
- [x] age = int(input("Age: "))
- [ ] age = input("Age: ").int
- [ ] int age = input("Age: ")
> input() runs first and returns text; int() converts it.

### Q: How many times does this loop print "Hi"?
```python
for i in range(2, 6):
    print("Hi")
```
- [ ] 6
- [ ] 5
- [x] 4
- [ ] 3
> range(2, 6) gives 2, 3, 4, 5 — four numbers.

### Q: What is printed?
```python
def double(n):
    return n * 2

print(double(double(3)))
```
- [ ] 6
- [x] 12
- [ ] 9
- [ ] 33
> double(3) is 6, and double(6) is 12.

### Q: Given `towns = ["Ho", "Wa", "Bolga"]`, what does `towns[-1]` return?
- [ ] Ho
- [ ] Wa
- [x] Bolga
- [ ] An error
> Negative indexes count from the end; -1 is the last item.

### Q(multiple): Which statements about dictionaries are true?
- [x] They store key–value pairs
- [x] `.get()` can return a default value when a key is missing
- [ ] Keys are accessed by position number like lists
- [x] They are good for labelled information about one thing
> Dictionaries are accessed by key, not position.

### Q: Which operator checks whether two values are equal?
- [ ] =
- [x] ==
- [ ] ===
- [ ] :=
> `=` assigns; `==` compares.

### Q: Which code prints only the even numbers from 0 to 10?
- [x] `for n in range(0, 11, 2): print(n)`
- [ ] `for n in range(10): print(n * 3)`
- [ ] `for n in range(2, 10): print(n)`
- [ ] `while n < 10: print(n)`
> A step of 2 starting at 0 gives 0, 2, 4, 6, 8, 10.

### Q(tf): Python uses indentation to decide which lines belong inside an if statement or loop.
= true
> Indentation is part of Python's syntax.

### Q(short): What keyword is used to define a function in Python?
= def
> `def` starts a function definition.

### Q: Which block handles an error so the program doesn't crash?
- [ ] if / else
- [x] try / except
- [ ] for / in
- [ ] def / return
> try/except catches errors and lets you respond gracefully.
