/**
 * Shared types for the Update Docstring command. Everything under src/update is kept
 * free of the vscode module so it can be unit tested directly.
 */

/** Raised when the docstring cannot be updated confidently. The message is shown to the user. */
export class UpdateRefusal extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UpdateRefusal";
    }
}

export type ParamKind = "arg" | "kwarg" | "variadic";

/** One parameter of the current signature, in signature order. self and cls are skipped. */
export interface SignatureParam {
    name: string;
    stars: string;
    kind: ParamKind;
    /** Type the generator would write: the annotation or a guess from the default or name. */
    type?: string;
    /** Type from an explicit annotation only. Used to update existing entries. */
    annotation?: string;
    default?: string;
}

export interface SignatureValue {
    /** Type the generator would write, if any. */
    type?: string;
    /** Type taken from the return annotation, if any. */
    annotation?: string;
}

export interface Signature {
    params: SignatureParam[];
    returns?: SignatureValue;
    yields?: SignatureValue;
    exceptions: string[];
}

export interface FormatOptions {
    /** False for the -notypes formats: types in the docstring are never touched. */
    includeTypes: boolean;
    /** The docstep.guessTypes setting. When false, new entries get the _type_ placeholder. */
    guessTypes: boolean;
    /** The docstep.includeVariadicArgs setting. When false, missing *args and **kwargs are not added. */
    includeVariadicArgs?: boolean;
    /** The docstep.detectRenames setting. When true, one parameter renamed in place keeps its description. */
    detectRenames?: boolean;
}

export const typePlaceholder = "_type_";
export const descriptionPlaceholder = "_description_";
