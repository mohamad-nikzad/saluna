import unittest
import urllib.request
from unittest.mock import patch

import network


class LocalGatewayTests(unittest.TestCase):
    def test_transport_stays_on_loopback_with_staging_host(self):
        opener = network.opener(local_gateway=True)
        handler = next(h for h in opener.handlers if h.__class__.__name__ == 'LocalGatewayHandler')
        request = urllib.request.Request('https://staging-app.saluna.ir/api/v1/health')
        def inspect(factory, request):
            connection = factory(request.host, timeout=10)
            self.assertEqual(connection.host, 'staging-app.saluna.ir')
            self.assertEqual(request.get_header('Host'), 'staging-app.saluna.ir')
            with patch.object(network.socket, 'create_connection') as connect:
                connection._create_connection(('ignored', 443), 10)
            connect.assert_called_once_with(('127.0.0.1', 80), 10)
        with patch.object(handler, 'do_open', side_effect=inspect):
            handler.https_open(request)

    def test_other_hosts_and_plain_http_are_refused(self):
        opener = network.opener(local_gateway=True)
        for url in ('https://saluna.ir/api/v1/health', 'http://staging-app.saluna.ir/api/v1/health'):
            with self.subTest(url=url), patch.object(network.socket, 'create_connection') as connect:
                with self.assertRaisesRegex(RuntimeError, 'Local QA transport'):
                    opener.open(url)
                connect.assert_not_called()
