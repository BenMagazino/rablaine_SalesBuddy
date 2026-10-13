"""Work IQ transport uses explicit UTF-8 rather than the Windows locale."""

from subprocess import CompletedProcess
from unittest.mock import patch

import pytest

from app.services.workiq_service import query_workiq


@pytest.mark.parametrize('system', ['Windows', 'Linux'])
def test_workiq_transport_preserves_unicode(system: str) -> None:
    """Native output and Python decoding use the same UTF-8 encoding."""
    text = 'Meeting caf\u00e9 \u2013 summary'
    with (
        patch('app.services.workiq_service.platform.system', return_value=system),
        patch('shutil.which', return_value=r'C:\node\npx.cmd'),
        patch('app.services.workiq_service.subprocess.run',
              return_value=CompletedProcess([], 0, text, '')) as run,
        patch('app.services.workiq_service._record_workiq_call'),
    ):
        assert query_workiq('Find meeting summaries') == text
    assert run.call_args.kwargs['encoding'] == 'utf-8'
    if system == 'Windows':
        command = run.call_args.args[0][-1]
        assert '[Console]::OutputEncoding' in command
        assert '$OutputEncoding = [Console]::OutputEncoding' in command


def test_workiq_eula_acceptance_and_retry_use_utf8() -> None:
    """The initial query, EULA acceptance, and retry share explicit decoding."""
    results = [
        CompletedProcess([], 0, 'Please accept-eula', ''),
        CompletedProcess([], 0, 'Accepted', ''),
        CompletedProcess([], 0, 'Meeting caf\u00e9', ''),
    ]
    with (
        patch('app.services.workiq_service.platform.system', return_value='Windows'),
        patch('shutil.which', return_value=r'C:\node\npx.cmd'),
        patch('app.services.workiq_service.subprocess.run', side_effect=results) as run,
        patch('app.services.workiq_service._record_workiq_call'),
    ):
        assert query_workiq('Find meeting summaries') == 'Meeting caf\u00e9'
    assert run.call_count == 3
    assert all(call.kwargs['encoding'] == 'utf-8' for call in run.call_args_list)
    assert run.call_args_list[0].args[0] == run.call_args_list[2].args[0]
