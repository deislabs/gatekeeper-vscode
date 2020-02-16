# gatekeeper-vscode

Rapidly develop, test and deploy Gatekeeper policies for your Kubernetes cluster.

## Features

* Install Gatekeeper into a development cluster
* Browse constraints and constraint templates in the Kubernetes cluster explorer
* See which constraints have violations, and view violation details
* Deploy a constraint template directly from a Rego file and a JSON schema
* Scaffold a constraint from a constraint template
* Scaffold a JSON schema from constraint template Rego
* See a warning if template Rego uses a parameter not defined in the schema
* Switch a constraint's enforcement action between Deny and Dry Run
* View the constraint and template YAML definitions, and template Rego

## Authoring Constraint Templates and Constraints

**NOTE: This workflow is an alpha proposal, and may change based on feedback!**

A constraint template consists of some Rego, defining the policy, and a CRD definition,
specifying the names (e.g. the manifest kind) and validation schema for constraint
resources, all bundled together into a YAML resource declaration. You probably don't
want to have to work directly on such YAML: you'd rather, for example, create your Rego
in a separate where the OPA extension can give you syntax highlighting and testing features.

The Gatekeeper extension addresses this by allowing you to author your constraint template
in two separate files, which are linked by a naming convention:

* `<name>.rego` - the Rego policy definition for the constraint template
* `<name>.schema.json` - the JSON schema for the parameters

With this convention in place, you can right-click in the Rego file and choose
**Deploy as Gatekeeper Constraint Template**.  The extension will merge the Rego and
the parameter schema to create a YAML resource declaration, and display the
resulting YAML for you to confirm and deploy.

The `.rego/.schema.json` convention is also used for checks of the Rego file - for
example if the Rego refers to `input.parameters.<name>` then the extension will
warn if the `.schema.json` does not contain a declaration for `<name>`.

**Please give me feedback on this convention through [GitHub issues](https://github.com/deislabs/gatekeeper-vscode/issues)!**
Let me know if it causes problems, runs into limitations or is just fiddly to work with.  Thanks!

## Requirements

You will need the following VS Code extensions:

* Kubernetes (https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools)
* OPA (https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.kubernetes-opa-vscode)

These are automatically installed if you install this extension from the Visual Studio Marketplace.

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
