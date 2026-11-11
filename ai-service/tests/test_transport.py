import socket
import ssl
from unittest.mock import Mock, patch
import pytest
from app.security import PinnedHTTPSConnection, validate_url


def record(address):
    return (
        socket.AF_INET6 if ":" in address else socket.AF_INET,
        socket.SOCK_STREAM,
        6,
        "",
        (address, 443),
    )


def test_dual_stack_dns_prefers_ipv4_and_validates_the_entire_answer():
    with patch(
        "socket.getaddrinfo",
        return_value=[record("2606:4700:4700::1111"), record("34.107.134.98")],
    ):
        host, path, addresses = validate_url(
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/"
        )
    assert addresses == ["34.107.134.98", "2606:4700:4700::1111"]
    with patch(
        "socket.getaddrinfo",
        return_value=[record("34.107.134.98"), record("127.0.0.1")],
    ):
        with pytest.raises(ValueError, match="Private or reserved"):
            validate_url("https://pubchem.ncbi.nlm.nih.gov/rest/pug/")


def test_unreachable_pinned_address_falls_back_without_resolving_the_host_again():
    connection = PinnedHTTPSConnection(
        "pubchem.ncbi.nlm.nih.gov", ["34.107.134.98", "130.14.29.110"]
    )
    raw = Mock()
    context = Mock()
    connection._context = context
    with patch(
        "socket.create_connection",
        side_effect=[OSError(101, "Network is unreachable"), raw],
    ) as create:
        connection.connect()
    assert [c.args[0] for c in create.call_args_list] == [
        ("34.107.134.98", 443),
        ("130.14.29.110", 443),
    ]
    context.wrap_socket.assert_called_once_with(
        raw, server_hostname="pubchem.ncbi.nlm.nih.gov"
    )
    connection.sock.settimeout.assert_called_with(12)


def test_failed_addresses_produce_a_real_failure():
    connection = PinnedHTTPSConnection(
        "pubchem.ncbi.nlm.nih.gov", ["34.107.134.98", "130.14.29.110"]
    )
    with patch(
        "socket.create_connection", side_effect=OSError(101, "Network is unreachable")
    ) as create:
        with pytest.raises(OSError, match="Network is unreachable"):
            connection.connect()
    assert create.call_count == 2


def test_certificate_failure_closes_the_socket_and_is_not_bypassed():
    connection = PinnedHTTPSConnection(
        "pubchem.ncbi.nlm.nih.gov", ["34.107.134.98", "130.14.29.110"]
    )
    raw = Mock()
    context = Mock()
    context.wrap_socket.side_effect = ssl.SSLCertVerificationError("hostname mismatch")
    connection._context = context
    with patch("socket.create_connection", return_value=raw) as create:
        with pytest.raises(ssl.SSLCertVerificationError):
            connection.connect()
    create.assert_called_once()
    raw.close.assert_called_once()


def test_address_fallback_has_one_total_connection_deadline():
    connection = PinnedHTTPSConnection(
        "pubchem.ncbi.nlm.nih.gov", ["34.107.134.98", "130.14.29.110"]
    )
    with patch("app.security.time.monotonic", side_effect=[0, 0, 12.1]):
        with patch(
            "socket.create_connection", side_effect=OSError("route timed out")
        ) as create:
            with pytest.raises(OSError, match="route timed out"):
                connection.connect()
    create.assert_called_once_with(("34.107.134.98", 443), timeout=4)
