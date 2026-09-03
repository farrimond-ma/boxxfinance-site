"""
Generate professional PDF pitch document for commercial insurance broker.
Run: python generate_pitch_pdf.py
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

# ── Brand colours ──────────────────────────────────────────────────────────────
NAVY  = colors.HexColor('#031b49')
GOLD  = colors.HexColor('#b8922a')
LIGHT = colors.HexColor('#f8fafc')
MID   = colors.HexColor('#e5e7eb')
DARK  = colors.HexColor('#1f2937')
GREY  = colors.HexColor('#6b7280')
WHITE = colors.white

OUTPUT = r'C:\Users\MarkFarrimond\Boxx Commercial Finance\docs\pitch-commercial-insurance-broker.pdf'
W, H   = A4

# ── Styles ─────────────────────────────────────────────────────────────────────
def make_styles():
    return {
        'cover_title': ParagraphStyle('cover_title',
            fontName='Helvetica-Bold', fontSize=28, textColor=WHITE,
            leading=34, spaceAfter=6),
        'cover_sub': ParagraphStyle('cover_sub',
            fontName='Helvetica', fontSize=16, textColor=GOLD,
            leading=22, spaceAfter=4),
        'h2': ParagraphStyle('h2',
            fontName='Helvetica-Bold', fontSize=16, textColor=NAVY,
            leading=22, spaceBefore=18, spaceAfter=8),
        'h3': ParagraphStyle('h3',
            fontName='Helvetica-Bold', fontSize=12, textColor=NAVY,
            leading=16, spaceBefore=10, spaceAfter=4),
        'body': ParagraphStyle('body',
            fontName='Helvetica', fontSize=10, textColor=DARK,
            leading=16, spaceAfter=8, alignment=TA_JUSTIFY),
        'body_bold': ParagraphStyle('body_bold',
            fontName='Helvetica-Bold', fontSize=10, textColor=DARK,
            leading=16, spaceAfter=8),
        'bullet': ParagraphStyle('bullet',
            fontName='Helvetica', fontSize=10, textColor=DARK,
            leading=15, spaceAfter=4, leftIndent=14, firstLineIndent=-10),
        'italic_bullet': ParagraphStyle('italic_bullet',
            fontName='Helvetica-Oblique', fontSize=10, textColor=DARK,
            leading=15, spaceAfter=4, leftIndent=14, firstLineIndent=-10),
        'quote': ParagraphStyle('quote',
            fontName='Helvetica-Oblique', fontSize=11, textColor=NAVY,
            leading=17, spaceAfter=10, leftIndent=16, rightIndent=16,
            borderPadding=(8, 12, 8, 12)),
        'small': ParagraphStyle('small',
            fontName='Helvetica', fontSize=8, textColor=GREY,
            leading=12, spaceAfter=4, alignment=TA_CENTER),
        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=8, textColor=GREY,
            leading=10, alignment=TA_CENTER),
    }

S = make_styles()

# ── Page template with footer ──────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Footer rule
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, 14*mm, W - 20*mm, 14*mm)
    # Footer text
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(W/2, 10*mm, 'Autonomous Content & Distribution Engine  |  Confidential')
    canvas.drawRightString(W - 20*mm, 10*mm, f'Page {doc.page}')
    canvas.restoreState()

def on_first_page(canvas, doc):
    # Full navy cover background
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # Gold accent bar
    canvas.setFillColor(GOLD)
    canvas.rect(0, H * 0.38, W, 4, fill=1, stroke=0)
    canvas.restoreState()

# ── Helper flowables ───────────────────────────────────────────────────────────
def divider():
    return HRFlowable(width='100%', thickness=1, color=GOLD, spaceAfter=14, spaceBefore=4)

def section_header(text):
    return [
        Spacer(1, 6),
        Paragraph(text, S['h2']),
        HRFlowable(width='100%', thickness=1.5, color=GOLD, spaceAfter=10),
    ]

def body(text):
    # Handle inline bold (**text**) and italic (*text*)
    text = text.replace('**', '<b>', 1)
    while '**' in text:
        text = text.replace('**', '</b>', 1) if text.count('<b>') > text.count('</b>') else text.replace('**', '<b>', 1)
    text = text.replace('*', '<i>', 1)
    while '*' in text:
        text = text.replace('*', '</i>', 1) if text.count('<i>') > text.count('</i>') else text.replace('*', '<i>', 1)
    return Paragraph(text, S['body'])

def bullet(text, italic=False):
    # Clean markdown italic markers
    clean = text.lstrip('- ').replace('*', '')
    style = S['italic_bullet'] if italic else S['bullet']
    return Paragraph(f'<bullet>&bull;</bullet> {clean}', style)

# ── Build content ──────────────────────────────────────────────────────────────
def build_story():
    story = []

    # ── Cover page ──
    story.append(Spacer(1, H * 0.18))
    story.append(Paragraph('Autonomous Content &amp;<br/>Distribution Engine', S['cover_title']))
    story.append(Spacer(1, 8))
    story.append(Paragraph('Tailored for Commercial Insurance Brokers', S['cover_sub']))
    story.append(Spacer(1, H * 0.28))
    story.append(Paragraph('Confidential system overview', S['small']))
    story.append(PageBreak())

    # ── Section: The Problem ──
    story += section_header('The Problem This Solves')
    story.append(body(
        'A commercial insurance broker\'s growth depends almost entirely on being found at the right moment '
        '— when a business owner realises they\'re underinsured, when a new company needs employers\' '
        'liability for the first time, when a director googles "do I need professional indemnity insurance?"'
    ))
    story.append(body(
        'That moment increasingly happens not on Google\'s first page, but in an AI chatbot response. '
        'When a business owner asks ChatGPT or Perplexity <i>"what commercial insurance does a UK contractor '
        'need?"</i>, whose name comes back?'
    ))
    story.append(body(
        'Right now, for most independent brokers, the answer is nobody\'s. The aggregators (Simply Business, '
        'Comparethemarket) and the direct insurers (Hiscox, AXA) own that conversation. This system is how '
        'an independent broker takes it back — systematically, automatically, and at a cost that makes the '
        'economics undeniable.'
    ))

    # ── Section: What It Does ──
    story += section_header('What the System Does')
    story.append(body('Every working day, without any human input:'))
    story.append(Spacer(1, 4))

    story.append(Paragraph('<b>Two original articles are published</b> on the broker\'s website. Each one is a minimum '
        '1,200-word expert guide. Examples:', S['body']))
    for item in [
        '"Employers\' Liability Insurance: What UK Businesses Must Have by Law"',
        '"Professional Indemnity Insurance for Consultants: How Much Cover Do You Actually Need?"',
        '"Does Your Commercial Property Insurance Cover Flood Damage? Most Don\'t"',
        '"Cyber Insurance for SMEs: What\'s Changed Since the NCSC Updated Its Guidance"',
    ]:
        story.append(bullet(item, italic=True))
    story.append(Spacer(1, 6))

    story.append(body(
        'Each article is structured specifically to appear as an authoritative answer in AI tools like '
        'ChatGPT, Google AI Overviews, and Perplexity — not just to rank on Google.'
    ))

    story.append(Paragraph('<b>Five location-specific service pages are published</b> every day — for example '
        '"Commercial Insurance Brokers Manchester", "Employers Liability Insurance Leeds", '
        '"Professional Indemnity Insurance Birmingham". At five pages per day, this creates '
        '<b>1,826 pages across 166 UK towns and cities</b>, covering every major local market across '
        'your key product lines.', S['body']))

    story.append(body(
        '<b>Six social media channels are updated automatically</b> — LinkedIn posts from named brokers, '
        'Facebook posts, Instagram, Pinterest pins, Facebook Reels, and TikTok videos — all generated '
        'from the day\'s articles. No social media manager. No agency. No brief required.'
    ))

    # ── Section: AI Visibility ──
    story += section_header('The AI Visibility Advantage')
    story.append(body(
        'Every Monday, the system sends 80 questions to ChatGPT, Perplexity, and Claude — the questions '
        'your prospects are actually asking right now:'
    ))
    for q in [
        '"Best commercial insurance brokers UK"',
        '"How much does public liability insurance cost for a small business?"',
        '"Do contractors need professional indemnity insurance?"',
        '"What is business interruption insurance and do I need it?"',
        '"Fleet insurance for small businesses UK"',
        '"Directors and officers insurance explained UK"',
    ]:
        story.append(bullet(q, italic=True))
    story.append(Spacer(1, 6))
    story.append(body(
        'For each question it records: is your firm mentioned? Which competitors are mentioned? '
        'How does your visibility score change week on week? Topics where you\'re invisible become '
        'the next day\'s articles. The system continuously closes the gap — automatically, every week.'
    ))
    story.append(Paragraph(
        '<b>Competitors tracked:</b> Aon, Marsh, Willis Towers Watson, Hiscox, Simply Business, '
        'Arthur J. Gallagher, Lockton, Howden, Towergate, PolicyBee, and any others you specify.',
        S['body']))

    # ── Section: Scale ──
    story += section_header('Scale at Full Operation')

    scale_data = [
        ['', 'Daily', 'Monthly', 'Annual'],
        ['Expert insurance articles', '2', '~44', '~520'],
        ['Location service pages', '5', '~110', '1,826'],
        ['LinkedIn posts (named brokers)', '2', '~44', '~520'],
        ['Facebook posts', '2', '~44', '~520'],
        ['Instagram posts', '2', '~44', '~520'],
        ['Pinterest pins', '2', '~44', '~520'],
        ['Short-form videos (Reels/TikTok)', '2', '~44', '~520'],
        ['TOTAL CONTENT PIECES', '17', '~374', '~4,940'],
    ]
    scale_table = Table(scale_data, colWidths=[95*mm, 25*mm, 28*mm, 28*mm])
    scale_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BACKGROUND', (0,-1), (-1,-1), GOLD),
        ('TEXTCOLOR', (0,-1), (-1,-1), WHITE),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,-2), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [WHITE, LIGHT]),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, MID),
        ('LINEBELOW', (0,0), (-1,0), 1, NAVY),
    ]))
    story.append(scale_table)
    story.append(Spacer(1, 8))
    story.append(body(
        'For context: a typical mid-size insurance broker publishes perhaps 2-3 blog posts per month. '
        'This system publishes 44. In one year it produces more authoritative insurance content than '
        'most brokers will publish in a decade.'
    ))

    # ── Section: Content Library ──
    story += section_header('The Content Library')
    story.append(body('The system covers the full breadth of a commercial insurance broker\'s product range:'))

    for heading, items in [
        ('Product-led articles', 'Professional indemnity · Employers liability · Public liability · Commercial property · Business interruption · Cyber insurance · Directors & officers · Product liability · Fleet insurance · Marine cargo · Trade credit · Engineering inspection · Management liability · Key person insurance · Commercial legal expenses'),
        ('Sector-led articles', 'Insurance for contractors · Tradespeople · Retailers · Hospitality businesses · Professional services firms · Healthcare providers · Manufacturers · Technology companies · Charities · Property investors'),
        ('Buyer journey articles', 'How to compare commercial insurance quotes · What voids a business insurance claim · Understanding policy excesses · How to handle a claim · What an insurance broker does vs going direct · Mid-term adjustments explained'),
    ]:
        story.append(Paragraph(f'<b>{heading}:</b>', S['body']))
        story.append(Paragraph(items, ParagraphStyle('tag_list',
            fontName='Helvetica', fontSize=9.5, textColor=DARK,
            leading=15, spaceAfter=8, leftIndent=12)))

    story.append(body(
        '<b>1,826 location pages</b> covering all 11 product categories across 166 UK towns and cities '
        '— creating local search dominance in every market the broker serves.'
    ))

    # ── Section: Social Media ──
    story += section_header('Social Media: Named Experts, Not Generic Posts')
    story.append(body(
        'LinkedIn posts are attributed to named senior brokers at the firm — building individual thought '
        'leadership alongside the brand. Each post draws a genuine insight from that day\'s article, '
        'written in a conversational expert voice:'
    ))

    # Quote block
    quote_data = [['<i>"Most businesses only discover their business interruption cover is inadequate after a '
        'claim. Here\'s the calculation your insurer uses that most policyholders never see..."</i>']]
    quote_table = Table(quote_data, colWidths=[155*mm])
    quote_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LINEBEFORE', (0,0), (0,-1), 3, GOLD),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Oblique'),
        ('FONTSIZE', (0,0), (-1,-1), 10.5),
        ('TEXTCOLOR', (0,0), (-1,-1), NAVY),
    ]))
    story.append(quote_table)
    story.append(Spacer(1, 8))
    story.append(body(
        'Two posts per day, alternating between named individuals. The company page is reshared '
        'automatically. Facebook, Instagram, Pinterest, and short-form video (Reels and TikTok) '
        'are all updated automatically — each adapted to the platform\'s format and audience.'
    ))

    # ── Section: Cost ──
    story += section_header('What It Costs to Run')

    cost_data = [
        ['Component', 'Monthly Cost'],
        ['Article generation (GPT-4o)', '~£2-3'],
        ['Social post generation (Claude AI)', '~£1'],
        ['Hero photography (Pexels)', '£0 — free API'],
        ['Video voiceover (ElevenLabs)', '£0 — free tier'],
        ['Video production (ffmpeg)', '£0 — open source'],
        ['AI visibility checking', '~£2'],
        ['Website hosting', '~£10'],
        ['All automation (GitHub Actions)', '£0 — free tier'],
        ['TOTAL MONTHLY RUNNING COST', '~£15-20'],
    ]
    cost_table = Table(cost_data, colWidths=[110*mm, 66*mm])
    cost_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), NAVY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BACKGROUND', (0,-1), (-1,-1), GOLD),
        ('TEXTCOLOR', (0,-1), (-1,-1), WHITE),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,1), (-1,-2), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [WHITE, LIGHT]),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, MID),
    ]))
    story.append(cost_table)
    story.append(Spacer(1, 10))

    # Agency comparison box
    comp_data = [['Typical alternative costs for equivalent output:'
        '\n  Content agency (2 articles/week):   £2,000-4,000/month'
        '\n  SEO agency:                          £1,500-3,000/month'
        '\n  Social media management:              £800-1,500/month'
        '\n  Total comparable agency spend:    £4,300-8,500/month']]
    comp_table = Table(comp_data, colWidths=[155*mm])
    comp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fef3c7')),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LINEBEFORE', (0,0), (0,-1), 3, GOLD),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9.5),
        ('TEXTCOLOR', (0,0), (-1,-1), DARK),
    ]))
    story.append(comp_table)

    # ── Section: Competitive Moat ──
    story += section_header('The Competitive Moat')
    story.append(body(
        'The content library that accumulates over the first 12 months becomes a structural '
        'competitive asset:'
    ))
    for item in [
        '520+ long-form insurance articles on the website',
        '1,826 location pages covering every UK market',
        'Thousands of social media posts across six platforms',
        'Weekly AI visibility scores across 80 insurance queries',
        'Internal linking structure connecting every article and location page',
    ]:
        story.append(bullet(item))
    story.append(Spacer(1, 6))
    story.append(body(
        'A competitor could not replicate this in less than 3-4 years of manual content production. '
        'The domain authority and topical authority that accumulates with this volume of specialist '
        'content creates a compounding advantage that only grows over time.'
    ))
    story.append(body(
        '<b>The AI visibility data has standalone value.</b> A weekly report showing which insurance queries '
        'mention which brokers, tracked over time, is competitive intelligence that does not exist '
        'anywhere else in the market.'
    ))

    # ── Section: Implementation ──
    story += section_header('Implementation')

    impl_data = [
        ['Setup time', '2-4 weeks from engagement to fully operational'],
        ['What\'s needed\nfrom the broker',
         '- Domain access (to deploy or add to existing site)\n'
         '- Social media account credentials for each platform\n'
         '- Two or three named brokers for LinkedIn attribution\n'
         '- A list of core product areas and target sectors'],
        ['Ongoing input\nrequired', 'None. The system operates entirely autonomously after setup.'],
    ]
    impl_table = Table(impl_data, colWidths=[38*mm, 118*mm])
    impl_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9.5),
        ('TEXTCOLOR', (0,0), (0,-1), NAVY),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [WHITE, LIGHT, WHITE]),
        ('GRID', (0,0), (-1,-1), 0.5, MID),
        ('LINEAFTER', (0,0), (0,-1), 1.5, GOLD),
    ]))
    story.append(impl_table)

    # ── Section: Summary ──
    story += section_header('Summary')
    story.append(body(
        'The commercial insurance market is consolidating around aggregators and direct writers. '
        'Independent brokers are being squeezed on both sides — price comparison on one end, '
        'major broker groups on the other.'
    ))
    story.append(body(
        'The brokers who survive and grow in this environment will be those who own the authoritative '
        'voice on commercial insurance for UK businesses — the ones that appear when a director googles '
        'a question, when a contractor asks an AI chatbot, when a retailer searches for a local broker.'
    ))

    # Final statement box
    final_data = [['This system makes that happen.\nAutomatically. Every day.\nFor £15-20 a month in running costs.']]
    final_table = Table(final_data, colWidths=[155*mm])
    final_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), NAVY),
        ('TEXTCOLOR', (0,0), (-1,-1), WHITE),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 14),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 20),
        ('BOTTOMPADDING', (0,0), (-1,-1), 20),
        ('LEFTPADDING', (0,0), (-1,-1), 20),
        ('RIGHTPADDING', (0,0), (-1,-1), 20),
    ]))
    story.append(Spacer(1, 12))
    story.append(final_table)
    story.append(Spacer(1, 16))
    story.append(Paragraph(
        'Built on: React · Node.js · GitHub Actions · OpenAI GPT-4o · Anthropic Claude · '
        'ElevenLabs · Pexels · ffmpeg · LinkedIn API · Facebook Graph API · Instagram Graph API · '
        'Pinterest API · TikTok Content Posting API · Reddit API · YouTube Data API · '
        'Perplexity API · Google Sheets',
        S['small']
    ))

    return story

# ── Render ─────────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=20*mm,
    rightMargin=20*mm,
    topMargin=20*mm,
    bottomMargin=22*mm,
    title='Autonomous Content & Distribution Engine — Commercial Insurance Brokers',
    author='Confidential',
)

story = build_story()
doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
print(f'PDF saved to: {OUTPUT}')
