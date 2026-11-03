# UDT declarations

SCL IDE parses and resolves named `TYPE … END_TYPE` definitions and executes variables using their resolved schemas. This is a bounded interpreter feature, not verification against a Siemens compiler.

## Use in the app

1. Select **Nowy typ UDT** in the Files panel, or import a source file containing TYPE definitions.
2. Paste the actual definitions exported from your PLC project. A standalone file can contain several TYPE definitions. Its types are available to the other files in the workspace.
3. Open the FB/FC/OB and use the type names in its variable declarations. TYPE definitions can also appear before or after the single executable block in the same source. Those inline definitions belong to that file.
4. Check the program, edit input fields and run or step a scan. TYPE-only files are checked but their simulation and variable-wizard controls are disabled.

[UDT_Belki.scl](../dist/UDT_Belki.scl) provides the definitions shown in the supplied TIA screenshot: three pressure fields, beam position/activation and four `UDT_Magnes` members with position, activation, plate and correction flags. The nested magnet definition follows the beam definition, also exercising forward resolution. These definitions contain no instance data; check them against your full project if it has additional fields.

The FB can then retain its original declarations:

```scl
VAR_INPUT
    BelkaCisnienie : ARRAY[0..10] OF "UDT_BelkaCisnienie";
    PozycjeBelek : ARRAY[0..10] OF "UDT_WybranaBelka";
END_VAR
```

The pressure FB fixture is unchanged in behaviour: set `IloscBelek` within 0..10, populate pressure/position inputs and allow the two-second filter to elapse. It is a selection algorithm, not a pneumatic plant simulation. The interpreter reports an array-bound error if the supplied beam count exceeds its declared arrays; this change does not modify that PLC algorithm.

## Implemented

- Quoted or unquoted names, case-insensitive resolution, optional VERSION and existing TIA attribute syntax.
- Forward references, nested STRUCT/UDT fields, arrays of UDTs and multidimensional arrays.
- Scalar constant field defaults; separate memory per array element and instance. VAR_TEMP retains its existing reset-per-scan behaviour.
- Type-name completion, array/member completion, TYPE snippet, formatting and TYPE/STRUCT folding.
- Existing I/O editing, watches and inline values work through resolved field schemas.
- Unknown types, duplicate names/fields and direct or indirect cycles produce diagnostics. Errors in external type files retain their source identity and UTF-16 token ranges; the UI opens that file.
- Only active workspace files supply definitions. Moving a file to Trash removes its types; deletion/restoration invalidates compiled code. No storage format migration is needed: project JSON/history already store all source files.

## Limits

One executable block/instance still runs. This does not implement custom FC/FB calls, DB-source resolution, pointers, open arrays, ANY/VARIANT, hardware or complete Siemens type checking. Aggregate array/STRUCT initializers are unsupported. Field defaults must evaluate without instance/global variables. Project TYPE sources have a combined 1 MB cap; type depth, schema size and runtime allocation remain bounded. The variable wizard continues to offer its existing basic types; write UDT variable declarations in SCL with completion.

Completion still uses the existing synchronous parser. Recovery of arbitrary incomplete syntax and a full language-service facade remain separate work. TYPE resolution does not imply all field/type errors are caught before execution.

## Validation and rollback

`npm test`: 169 passing tests, including 17 UDT regressions and the supplied pressure FB fixture. The latter checks two-second filtering, carriage tolerance, critical priority, nearest-beam selection, lower-index ties and timer reset. Browser QA checks TYPE creation, separate-file references, input editing, one scan, output/inline values, reload and the TYPE-only view.

Before-change reference: `5db4f2b7a523ee8523fa8a5baba006748d2e0737`. An independent source checkpoint and verified Git bundle were made before editing. Restore from that reference in a new branch, or revert the feature commit after merge; avoid force-pushing shared history.
