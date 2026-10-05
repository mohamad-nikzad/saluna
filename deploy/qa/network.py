"""Optional workstation interface selection; HTTPS certificate checks stay enabled."""
import http.client
import os
import socket
import sys
import urllib.request


def opener(*handlers):
    interface = os.environ.get('SALUNA_QA_NETWORK_INTERFACE')
    if not interface:
        return urllib.request.build_opener(*handlers)
    if sys.platform != 'darwin':
        raise RuntimeError('Explicit QA network interface currently requires macOS')
    index = socket.if_nametoindex(interface)

    def connect(address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None):
        last_error = None
        for family, kind, protocol, _, target in socket.getaddrinfo(*address, socket.AF_INET, socket.SOCK_STREAM):
            connection = socket.socket(family, kind, protocol)
            try:
                if timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                    connection.settimeout(timeout)
                connection.setsockopt(socket.IPPROTO_IP, 25, index)  # macOS IP_BOUND_IF
                if source_address:
                    connection.bind(source_address)
                connection.connect(target)
                return connection
            except OSError as error:
                last_error = error
                connection.close()
        raise last_error or OSError('QA host could not be resolved')

    def https_connection(*args, **kwargs):
        connection = http.client.HTTPSConnection(*args, **kwargs)
        connection._create_connection = connect
        return connection

    class InterfaceHTTPSHandler(urllib.request.HTTPSHandler):
        def https_open(self, request):
            return self.do_open(https_connection, request, context=self._context)

    return urllib.request.build_opener(*handlers, InterfaceHTTPSHandler())
