import { useState } from 'react';
import Head from 'next/head';
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Box,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';

export default function Home() {
  const [url, setUrl] = useState('https://');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [headlessRender, setHeadlessRender] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState({ issues: false, keywords: false, sitemap: false, ga: false });

  const toggleDetail = (section) => {
    setDetailsVisible((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const onScan = async (event) => {
    event.preventDefault();
    setError('');
    setReport(null);

    try {
      const normalizedUrl = new URL(url).toString();
      setLoading(true);
      const query = headlessRender ? '?headless=true' : '';

      const res = await fetch(`/api/scan?url=${encodeURIComponent(normalizedUrl)}${query}`);
      const payload = await res.json();

      if (!res.ok) {
        setError(payload.message || 'Scan failed.');
      } else {
        setReport(payload);
      }
    } catch (err) {
      setError('Invalid URL or scan error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reportSection = () => {
    if (!report) return null;

    const renderHeadings = (type) => report.headings[type]?.map((text, idx) => <ListItem key={`${type}-${idx}`}><ListItemText primary={text || '<empty>'} /></ListItem>);

    return (
      <>
        <Card elevation={3} sx={{ mt: 4 }}>
          <CardHeader title={`SEO Report: ${report.url}`} subheader={`Final URL: ${report.finalUrl || report.url}`} />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Status</Typography>
                <Chip label={report.status} color={report.status === 200 ? 'success' : 'error'} size="small" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Fetch</Typography>
                <Chip label={`${report.fetchTime}ms`} size="small" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2">Redirects</Typography>
                <Chip label={`${report.redirectChain?.length || 0}`} size="small" />
              </Grid>

              <Grid item xs={12} md={12}>
                <Typography variant="h5" sx={{ mb: 1 }}>SEO score: {report.seoScore ?? 'N/A'} / 100</Typography>
                <Chip
                  label={`SEO score: ${report.seoScore ?? 'N/A'}`}
                  color={report.seoScore != null ? (report.seoScore >= 80 ? 'success' : report.seoScore >= 60 ? 'warning' : 'error') : 'default'}
                  size="small"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6">Meta</Typography>
                <List dense>
                  <ListItem><ListItemText primary="Title" secondary={report.title || '—'} /></ListItem>
                  <ListItem><ListItemText primary="Description" secondary={report.metaDescription || '—'} /></ListItem>
                  <ListItem><ListItemText primary="Canonical" secondary={report.canonical || '—'} /></ListItem>
                  <ListItem><ListItemText primary="Robots" secondary={report.robots || '—'} /></ListItem>
                  <ListItem><ListItemText primary="Viewport" secondary={report.viewport || '—'} /></ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Title length"
                      secondary={`${report.titleLength || 0} / 60${report.titleLength > 60 ? ' — Too long; keep it under 60 characters.' : ''}`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Description length"
                      secondary={`${report.descriptionLength || 0} / 160${report.descriptionLength > 160 ? ' — Too long; keep it under 160 characters.' : ''}`}
                    />
                  </ListItem>
                  <ListItem><ListItemText primary="Hreflang" secondary={`${report.metaCompleteness?.hreflang || 0}`} /></ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6">TLS</Typography>
                <List dense>
                  <ListItem><ListItemText primary="Protocol" secondary={report.tlsInfo?.protocol || 'N/A'} /></ListItem>
                  <ListItem><ListItemText primary="Issuer" secondary={report.tlsInfo?.certificate?.issuer?.O || 'N/A'} /></ListItem>
                  <ListItem><ListItemText primary="Valid from" secondary={report.tlsInfo?.certificate?.validFrom || 'N/A'} /></ListItem>
                  <ListItem><ListItemText primary="Valid to" secondary={report.tlsInfo?.certificate?.validTo || 'N/A'} /></ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6">Structured Data</Typography>
                <List dense>
                  <ListItem><ListItemText primary="JSON-LD" secondary={report.structuredData?.jsonLd?.length || 0} /></ListItem>
                  <ListItem><ListItemText primary="Microdata" secondary={report.structuredData?.microdata?.length || 0} /></ListItem>
                  <ListItem><ListItemText primary="RDFa" secondary={report.structuredData?.rdfa?.length || 0} /></ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6">Social</Typography>
                <List dense>
                  <ListItem><ListItemText primary="OpenGraph title" secondary={report.social?.openGraph?.title || 'missing'} /></ListItem>
                  <ListItem><ListItemText primary="Twitter title" secondary={report.social?.twitter?.title || 'missing'} /></ListItem>
                </List>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6">Headings</Typography>
                <Grid container>
                  {['h1','h2','h3','h4','h5','h6'].map((h) => (
                    <Grid item xs={6} sm={4} key={h}>
                      <Typography variant="subtitle2">{h.toUpperCase()} ({report.headings?.[h]?.length || 0})</Typography>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color={report.headingIssues?.length ? 'error' : 'success.main'}>
                    {report.headingIssues?.length ? report.headingIssues.join(' — ') : 'Heading structure looks good'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6">Link audit</Typography>
                <Typography variant="body2">Internal: {report.linkSummary?.internal || 0}, External: {report.linkSummary?.external || 0}, Broken: {report.brokenLinks || 0}</Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6">Image audit</Typography>
                <Typography variant="body2">Total images: {report.images?.length || 0}, Missing alt: {report.accessibility?.missingAlt || 0}</Typography>
              </Grid>

            </Grid>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Issues to fix" />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              {report.issuesToFix?.length ? `${report.issuesToFix.length} issue${report.issuesToFix.length === 1 ? '' : 's'} found.` : 'No major issues detected.'}
            </Typography>
            <Button size="small" onClick={() => toggleDetail('issues')}>See Results</Button>
            {detailsVisible.issues && (
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Issue</TableCell>
                    <TableCell>Impact</TableCell>
                    <TableCell>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report.issuesToFix || []).map((issue, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{issue.issue}</TableCell>
                      <TableCell>{issue.impact}</TableCell>
                      <TableCell>{issue.detail}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Most common keywords" />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              {report.commonKeywords?.length ? 'Top keywords used on the page:' : 'No strong keywords were detected.'}
            </Typography>
            <Button size="small" onClick={() => toggleDetail('keywords')}>See Results</Button>
            {detailsVisible.keywords && (
              <Table size="small" sx={{ mt: 2 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Keyword</TableCell>
                    <TableCell>Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(report.commonKeywords || []).map((keyword, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{keyword.keyword}</TableCell>
                      <TableCell>{keyword.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Sitemap check" />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              Sitemap XML: {report.robotsAndSitemap?.sitemapStatus === 200 ? 'Found' : 'Missing'}, Sitemap TXT: {report.robotsAndSitemap?.sitemapTxtStatus === 200 ? 'Found' : 'Missing'}
            </Typography>
            <Button size="small" onClick={() => toggleDetail('sitemap')}>See Results</Button>
            {detailsVisible.sitemap && (
              <List dense sx={{ mt: 2 }}>
                <ListItem>
                  <ListItemText primary="robots.txt" secondary={`${report.robotsAndSitemap?.robotsUrl || 'N/A'} (${report.robotsAndSitemap?.robotsStatus || 'N/A'})`} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="sitemap.xml" secondary={`${report.robotsAndSitemap?.sitemapUrl || 'N/A'} (${report.robotsAndSitemap?.sitemapStatus || 'N/A'})`} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="sitemap.txt" secondary={`${report.robotsAndSitemap?.sitemapTxtUrl || 'N/A'} (${report.robotsAndSitemap?.sitemapTxtStatus || 'N/A'})`} />
                </ListItem>
              </List>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Google Analytics test" />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              {report.googleAnalytics?.found ? `Detected: ${report.googleAnalytics.types.join(', ')}` : 'No Google Analytics snippet found.'}
            </Typography>
            <Button size="small" onClick={() => toggleDetail('ga')}>See Results</Button>
            {detailsVisible.ga && (
              <Box sx={{ mt: 2 }}>
                {report.googleAnalytics?.found ? (
                  report.googleAnalytics.details.map((item, idx) => (
                    <Typography key={idx} variant="body2">• {item}</Typography>
                  ))
                ) : (
                  <Typography variant="body2">No analytics patterns were detected on this page.</Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Headless render snapshot" />
          <CardContent>
            {report.headless?.error ? (
              <Alert severity="warning">Headless rendering failed: {report.headless.error}</Alert>
            ) : report.headless?.renderedHTML ? (
              <Box sx={{ backgroundColor: '#f4f6f8', p: 2, borderRadius: 1, maxHeight: 260, overflow: 'auto' }}>
                <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                  {report.headless.renderedHTML.slice(0, 1500)}...
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2">Headless rendering not enabled.</Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Broken and redirecting link details" />
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Redirect</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(report.linkDetails || []).slice(0, 20).map((link, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{link.href}</TableCell>
                    <TableCell>{link.status || 'error'}</TableCell>
                    <TableCell>{link.redirected ? 'yes' : 'no'}</TableCell>
                    <TableCell>{link.isExternal ? 'external' : 'internal'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardHeader title="Rich snippet preview" />
          <CardContent>
            <Typography variant="subtitle1">{report.seoPreview?.title}</Typography>
            <Typography variant="body2" color="text.secondary">{report.seoPreview?.description}</Typography>
            <Typography variant="caption" color="text.secondary">{report.seoPreview?.url}</Typography>
          </CardContent>
        </Card>
      </>
    );
  };

  return (
    <>
      <Head>
        <title>SEO Scanner | GDG Vibe Coding</title>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Website SEO Scanner
        </Typography>

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={<Switch checked={headlessRender} onChange={(e) => setHeadlessRender(e.target.checked)} />}
            label="Enable headless JS render (slow)"
          />
        </Box>

        <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth
                label="Website URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="contained" size="large" onClick={onScan} disabled={loading}>
                {loading ? 'Scanning…' : 'Scan site'}
              </Button>
            </Grid>
          </Grid>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {reportSection()}
      </Container>
    </>
  );
}
