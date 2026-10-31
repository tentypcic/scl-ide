# Test program — FB_TestSCL

In SCL Lab open **Pliki → Kod testowy SCL**. It creates a separate program and preserves existing editor text and files. Alternatively, import or copy [`FB_TestSCL.scl`](../dist/FB_TestSCL.scl).

## Run

1. Keep `Stop = FALSE`, `Reset = FALSE`, `Tryb = 1`, `WartoscTestowa = 7`.
2. Click the **1 cykl** pulse beside `Start`, then **Uruchom**. Or set Start from FALSE to TRUE and run.
3. Watch `Krok`: 0 → 10 → 20 (timer wait) → 30 → 40, then `Gotowe = TRUE`.
4. Use a breakpoint at the loop, **F10** (instruction) or **Shift+F10** (scan) to inspect individual operations. All loop iterations execute in one PLC scan; Run usually passes them too quickly to inspect.
5. To rerun, release Start to FALSE, give Reset one cycle, release Reset, then give a new Start pulse. A continuously TRUE Start is not a new edge. Stop and Reset return the sequence to step 0, clear Done and deliberately retain calculated values.

Timers use simulation time. `CzasET` increases while step 20 is active and returns to zero after the timer input becomes FALSE.

## Expected outputs

| Output | Default expected value |
| --- | --- |
| SumaFOR | 55 |
| SumaWHILE | 15 |
| SumaREPEAT | 10 |
| Parzyste | 5 |
| SumaBY | 30 |
| SumaExitContinue | 12 |
| OcenaIF | 1 |
| WynikCASE | 80 |
| WynikREAL | 27.5 |
| Znormalizowana | 0.5 |
| Przeskalowana | 50 |
| Tekst | ABC-OK |
| PozycjaTekstu | 5 |
| Bity | 16 |
| Krok / Gotowe / Zajety | 40 / TRUE / FALSE |

`Dane[1..10].Liczba` contains 1..10; `.Parzysta` is TRUE for 2, 4, 6, 8, 10.

Before starting a new sequence, select `Tryb = 2` for 110, `3` for 45, or any other value (e.g. 9) for −1. `WartoscTestowa > 10` gives `OcenaIF = 2`; 1..10 gives 1; 0 or a negative number gives 0.

This is a regression example for the implemented SCL subset. It is tested in SCL Lab, not reference-compiled in TIA Portal. It uses inline structures and two separate CASE statements; it does not claim nested CASE support.
