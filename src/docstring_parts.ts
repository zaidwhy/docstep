import dedent from "ts-dedent";

export interface DocstringParts {
    name: string;
    decorators: Decorator[];
    args: Argument[];
    kwargs: KeywordArgument[];
    /** `*args`, with its stars in `var`. Rendered only when docstep.includeVariadicArgs is on. */
    starArgs?: Argument[];
    /** `**kwargs`, with its stars in `var`. Rendered only when docstep.includeVariadicArgs is on. */
    starKwargs?: Argument[];
    exceptions: Exception[];
    returns: Returns;
    yields: Yields;
}

export interface Decorator {
    name: string;
}

export interface Argument {
    var: string;
    type: string;
}

export interface KeywordArgument {
    default: string;
    var: string;
    type: string;
}

export interface Exception {
    type: string;
}

export interface Returns {
    type: string;
    /** The names of a returned tuple (`return mean, spread`), for docstep.nameReturnValues. */
    values?: Argument[];
}

export interface Yields {
    type: string;
}

export function docstringPartsToString(docstringParts: DocstringParts): string {
    const decoratorsText = docstringParts.decorators.length
        ? docstringParts.decorators.map((decorator) => `${decorator.name}`).join("\n")
        : "N/A";
    const argsText = docstringParts.args.length
        ? docstringParts.args.map((argument) => `${argument.var} ${argument.type}`).join("\n")
        : "N/A";
    const kwargsText = docstringParts.kwargs.length
        ? docstringParts.kwargs.map((arg) => `${arg.var} ${arg.type} ${arg.default}`).join("\n")
        : "N/A";
    const exceptionsText = docstringParts.exceptions.length
        ? docstringParts.exceptions.map((exception) => `${exception.type}`).join("\n")
        : "N/A";
    const returnsText = `${docstringParts.returns?.type ?? "N/A"}`;
    const yieldsText = `${docstringParts.yields?.type ?? "N/A"}`;

    return dedent`
    Docstring parts:
        Name:
            ${docstringParts.name}
        Decorators:
            ${decoratorsText}
        Args:
            ${argsText}
        Kwargs:
            ${kwargsText}
        Exceptions:
            ${exceptionsText}
        Returns:
            ${returnsText}
        Yields:
            ${yieldsText}
    `;
}
