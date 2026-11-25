import type { Command, Option } from "commander";
import { reportError, usageError } from "./errors.js";
import { INVOICE_STATUSES } from "./commands/list-invoices.js";

export const COMPLETION_SHELLS = ["bash", "zsh", "powershell"] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

/** Values completed for options whose domain is a fixed list. */
const OPTION_CHOICES: Record<string, readonly string[]> = {
  "--network": ["testnet", "mainnet"],
  "--status": INVOICE_STATUSES,
};

interface OptionSpec {
  /** Long flag, or the short flag when a long one is absent. */
  name: string;
  takesValue: boolean;
  description: string;
  choices: readonly string[];
}

interface CommandSpec {
  name: string;
  description: string;
  options: OptionSpec[];
}

function optionSpec(option: Option): OptionSpec {
  const name = (option.long ?? option.short ?? "").trim();
  return {
    name,
    takesValue: option.flags.includes("<") || option.flags.includes("["),
    description: option.description ?? "",
    choices: OPTION_CHOICES[name] ?? [],
  };
}

/**
 * Extracts the completable surface from the live Commander definitions. Shell
 * scripts are always generated from this, never from a hand-maintained list, so
 * a new command or flag shows up after a rebuild.
 */
export function extractCommandSpecs(program: Command): {
  name: string;
  description: string;
  options: OptionSpec[];
  commands: CommandSpec[];
} {
  return {
    name: program.name(),
    description: program.description(),
    options: program.options.map(optionSpec),
    commands: [...program.commands]
      .sort((a, b) => a.name().localeCompare(b.name()))
      .map((command) => ({
        name: command.name(),
        description: command.description(),
        options: command.options.map(optionSpec),
      })),
  };
}

function singleLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").replace(/'/g, "").trim();
}

function uniqueOptions(options: OptionSpec[]): OptionSpec[] {
  const seen = new Set<string>();
  const result: OptionSpec[] = [];
  for (const option of options) {
    if (!option.name || seen.has(option.name)) continue;
    seen.add(option.name);
    result.push(option);
  }
  if (!seen.has("--help")) {
    result.push({
      name: "--help",
      takesValue: false,
      description: "display help for command",
      choices: [],
    });
  }
  return result;
}

function generateBash(program: Command): string {
  const spec = extractCommandSpecs(program);
  const commandNames = spec.commands.map((command) => command.name).join(" ");
  const globalOptions = uniqueOptions(spec.options)
    .map((option) => option.name)
    .join(" ");

  const cases = spec.commands
    .map((command) => {
      const options = uniqueOptions(command.options)
        .map((option) => option.name)
        .join(" ");
      return `    ${command.name})\n      opts="${options}"\n      ;;`;
    })
    .join("\n");

  const choiceCases = Object.entries(OPTION_CHOICES)
    .map(
      ([option, choices]) =>
        `    ${option})\n      COMPREPLY=( $(compgen -W "${choices.join(" ")}" -- "$cur") )\n      return 0\n      ;;`,
    )
    .join("\n");

  return `# bash completion for ${spec.name}
_${spec.name}_completion() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="${commandNames}"
  local global_opts="${globalOptions}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands} \${global_opts}" -- "\${cur}") )
    return 0
  fi

  case "\${prev}" in
${choiceCases}
  esac

  local sub="\${COMP_WORDS[1]}"
  local opts=""
  case "\${sub}" in
${cases}
  esac

  COMPREPLY=( $(compgen -W "\${opts} \${global_opts}" -- "\${cur}") )
  return 0
}
complete -F _${spec.name}_completion ${spec.name}
`;
}

function zshOption(option: OptionSpec): string {
  const description = singleLine(option.description);
  const choices =
    option.choices.length > 0
      ? `:${description}:(${option.choices.join(" ")})`
      : option.takesValue
        ? `:${description}:`
        : "";
  return `'${option.name}[${description}]${choices}'`;
}

function generateZsh(program: Command): string {
  const spec = extractCommandSpecs(program);
  const commands = spec.commands
    .map(
      (command) =>
        `    '${command.name}:${singleLine(command.description)}'`,
    )
    .join("\n");

  const cases = spec.commands
    .map((command) => {
      const args = uniqueOptions(command.options)
        .map((option) => `        ${zshOption(option)}`)
        .join(" \\\n");
      return `    ${command.name})\n      _arguments \\\n${args}\n      ;;`;
    })
    .join("\n");

  return `#compdef ${spec.name}
# zsh completion for ${spec.name}
_${spec.name}() {
  local -a commands
  commands=(
${commands}
  )

  if (( CURRENT == 2 )); then
    _describe -t commands '${spec.name} command' commands
    return
  fi

  case $words[2] in
${cases}
  esac
}

_${spec.name} "$@"
`;
}

function powerShellArray(values: readonly string[]): string {
  if (values.length === 0) return "@()";
  return `@(${values.map((value) => `'${value}'`).join(", ")})`;
}

function generatePowerShell(program: Command): string {
  const spec = extractCommandSpecs(program);
  const commands = spec.commands
    .map(
      (command) =>
        `        @{ Name = '${command.name}'; Description = '${singleLine(command.description)}' }`,
    )
    .join("\n");

  const optionMaps = spec.commands
    .map((command) => {
      const options = uniqueOptions(command.options)
        .map(
          (option) =>
            `            @{ Name = '${option.name}'; TakesValue = $${option.takesValue}; Choices = ${powerShellArray(option.choices)} }`,
        )
        .join("\n");
      return `        '${command.name}' = @(\n${options}\n        )`;
    })
    .join("\n");

  return `# PowerShell completion for ${spec.name}
Register-ArgumentCompleter -Native -CommandName ${spec.name} -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @(
${commands}
    )

    $optionMap = @{
${optionMaps}
    }

    $elements = @($commandAst.CommandElements | ForEach-Object { $_.ToString() })
    $currentCommand = if ($elements.Count -ge 2) { $elements[1] } else { $null }

    if ($elements.Count -le 2 -and -not $wordToComplete.StartsWith('-')) {
        $candidates = $commands | ForEach-Object { $_.Name }
    } elseif ($currentCommand -and $optionMap.ContainsKey($currentCommand)) {
        $previous = if ($elements.Count -ge 2) { $elements[$elements.Count - 2] } else { '' }
        $optionInfo = $optionMap[$currentCommand] | Where-Object { $_.Name -eq $previous }
        if ($optionInfo -and $optionInfo.Choices.Count -gt 0) {
            $candidates = $optionInfo.Choices
        } elseif ($wordToComplete.StartsWith('-')) {
            $candidates = $optionMap[$currentCommand] | ForEach-Object { $_.Name }
        } else {
            $candidates = @()
        }
    } else {
        $candidates = @()
    }

    $candidates | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
}
`;
}

export function parseCompletionShell(value: string): CompletionShell {
  const normalized = value.trim().toLowerCase();
  if (!COMPLETION_SHELLS.includes(normalized as CompletionShell)) {
    throw usageError(
      `Unknown shell "${value}". Expected one of: ${COMPLETION_SHELLS.join(", ")}.`,
    );
  }
  return normalized as CompletionShell;
}

/** Generates a completion script for `shell` from the live command tree. */
export function generateCompletion(
  program: Command,
  shell: string,
): string {
  switch (parseCompletionShell(shell)) {
    case "bash":
      return generateBash(program);
    case "zsh":
      return generateZsh(program);
    case "powershell":
      return generatePowerShell(program);
  }
}

/**
 * Registers `trusttrove completion <shell>`. The script is printed to stdout so
 * it can be sourced directly or redirected into the shell's completion
 * directory; see docs/cli.md for installation.
 */
export function registerCompletionCommand(program: Command): Command {
  return program
    .command("completion")
    .description("Print a shell completion script (bash, zsh, powershell)")
    .argument("<shell>", `shell to generate (${COMPLETION_SHELLS.join(", ")})`)
    .option("--json", "emit structured errors as JSON on stderr")
    .action((shell: string, options: { json?: boolean }) => {
      try {
        console.log(generateCompletion(program, shell));
      } catch (error) {
        reportError(error, { json: options.json });
      }
    });
}
