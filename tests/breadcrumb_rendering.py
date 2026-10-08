"""Static full-page discovery shared by breadcrumb coverage tests."""

import ast


def get_rendered_templates(module: ast.Module, function_name: str) -> set[str]:
    """Follow local renderer helpers without executing routes or database operations."""
    functions = {
        node.name: node for node in module.body if isinstance(node, ast.FunctionDef)
    }
    pending = [function_name]
    visited = set()
    templates = set()
    while pending:
        name = pending.pop()
        if name in visited or name not in functions:
            continue
        visited.add(name)
        for call in ast.walk(functions[name]):
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
                continue
            if call.func.id in functions:
                pending.append(call.func.id)
            if call.func.id == "render_template" and call.args:
                template = call.args[0]
                if isinstance(template, ast.Constant) and isinstance(template.value, str):
                    templates.add(template.value)
    return templates
