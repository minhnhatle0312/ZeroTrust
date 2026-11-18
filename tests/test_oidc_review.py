import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('oidc_review', Path(__file__).resolve().parents[1] / 'scripts/review_oidc.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class OidcReview(unittest.TestCase):
    def client(self):
        return {'publicClient':True,'standardFlowEnabled':True,'implicitFlowEnabled':False,
                'directAccessGrantsEnabled':False,'serviceAccountsEnabled':False,
                'redirectUris':['https://app.example.test/a/'],'webOrigins':['https://app.example.test'],
                'attributes':{'pkce.code.challenge.method':'S256'},
                'protocolMappers':[{'protocolMapper':'oidc-audience-mapper','config':{
                    'included.custom.audience':'employee-api','access.token.claim':'true','id.token.claim':'false'}}]}

    def check(self, client):
        return review.review_client(client,'https://app.example.test/a/','employee-api')

    def test_valid_public_client(self):
        result = self.check(self.client())
        self.assertTrue(all(v for k,v in result.items() if k != 'scopedRedirectWildcardNeedsReview'))

    def test_global_or_cross_app_redirect_is_rejected(self):
        for value in ['*','https://app.example.test/*','https://app.example.test/b/','https://rogue.example.test/a/']:
            client = self.client();client['redirectUris']=[value]
            self.assertFalse(self.check(client)['redirectsConfinedToApp'])

    def test_scoped_wildcard_flagged_without_changing_policy(self):
        client = self.client();client['redirectUris']=['https://app.example.test/a/*']
        result = self.check(client)
        self.assertTrue(result['redirectsConfinedToApp'])
        self.assertTrue(result['scopedRedirectWildcardNeedsReview'])

    def test_origins_cannot_be_wildcards_or_lookalikes(self):
        client = self.client();client['webOrigins']=['https://app.example.test.rogue.test']
        self.assertFalse(self.check(client)['exactOrigins'])

    def test_direct_grants_and_implicit_fail_review(self):
        for key in ['directAccessGrantsEnabled','implicitFlowEnabled']:
            client = self.client();client[key]=True
            self.assertFalse(self.check(client)['codeFlowOnly'])

    def test_cross_client_audience_is_rejected(self):
        client = self.client();client['protocolMappers'][0]['config']['included.custom.audience']='security-api'
        self.assertFalse(self.check(client)['accessTokenAudience'])

    def test_discovery_detects_wrong_issuer_and_endpoint_origin(self):
        result = review.review_discovery({'issuer':'https://rogue.example.test'},'https://app.example.test/realms/company-iam')
        self.assertFalse(result['issuerMatches'])
        self.assertFalse(result['endpointsStayOnIssuerOrigin'])


if __name__ == '__main__':
    unittest.main()
