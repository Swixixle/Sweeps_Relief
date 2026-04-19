from sweeps_relief.discovery.normalize import normalize_domain, normalize_seed_lines


def test_normalize_url_and_plain():
    assert normalize_domain("  HTTPS://Example.COM/path  ") == "example.com"
    assert normalize_domain("foo.bar") == "foo.bar"


def test_normalize_seed_lines_dedupe():
    assert normalize_seed_lines(["a.com", "A.COM", "# comment", "https://b.com/x"]) == [
        "a.com",
        "b.com",
    ]
