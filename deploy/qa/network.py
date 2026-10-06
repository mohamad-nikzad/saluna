"""Optional workstation interface selection; HTTPS certificate checks stay enabled."""
import http.client
import os
import socket
import sys
import urllib.request


def opener(*handlers, local_gateway=False):
    if local_gateway:
        # On the VPS, use its existing loopback gateway with the staging Host.
        # Keep the logical HTTPS URL so secure QA session cookies still work.
        # This transport can never connect to another host or leave loopback.
        def gateway_connection(host, **kwargs):
            if host != 'staging-app.saluna.ir':
                raise RuntimeError('Local QA transport only accepts the staging app host')
            connection = http.client.HTTPConnection(host, 80, timeout=kwargs.get('timeout'))
            connection._create_connection = lambda address, timeout, source_address=None: socket.create_connection(('127.0.0.1', 80), timeout)
            return connection

        class LocalGatewayHandler(urllib.request.HTTPSHandler):
            def https_open(self, request):
                request.add_unredirected_header('Host', 'staging-app.saluna.ir')
                return self.do_open(gateway_connection, request)

        class RefuseHTTPHandler(urllib.request.HTTPHandler):
            def http_open(self, request):
                raise RuntimeError('Local QA transport refuses non-HTTPS URLs')

        return urllib.request.build_opener(*handlers, LocalGatewayHandler(), RefuseHTTPHandler())
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
