import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateData() {
    const data = [];
    const startDate = new Date(2021, 2, 1); // March 2021
    const endDate = new Date(2026, 2, 1);   // March 2026

    let currentDate = new Date(endDate);

    // Base starting values for March 2026
    let baseUnsecuredRate = 8.2;
    let baseApprovalRate = 69;
    let baseAssetVolume = 3.3;

    while (currentDate >= startDate) {
        const monthYear = currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        const slug = monthYear.toLowerCase().replace(' ', '-');

        // Add some random fluctuation tailored to the specific historical period
        let unsecuredRateOffset = (Math.random() * 0.4) - 0.2;
        let approvalRateOffset = Math.floor(Math.random() * 3) - 1;
        let assetVolumeOffset = (Math.random() * 0.2) - 0.1;

        // Apply macro trends: rates were lower in 2021/2022
        if (currentDate.getFullYear() < 2023) {
            baseUnsecuredRate -= 0.15; // Gradually lower rates as we go back in time
            baseApprovalRate += 0.5;   // Higher approval rates pre-rate hikes
            baseAssetVolume -= 0.05;   // Lower volume further back
        } else if (currentDate.getFullYear() === 2023) {
            // Rate hike shock period
            baseUnsecuredRate -= 0.05;
            baseApprovalRate += 0.2;
        }

        const unsecuredRate = (baseUnsecuredRate + unsecuredRateOffset).toFixed(1);
        const approvalRate = Math.min(85, Math.max(50, Math.round(baseApprovalRate + approvalRateOffset)));
        const assetVolume = Math.max(2.0, (baseAssetVolume + assetVolumeOffset)).toFixed(1);

        data.push({
            id: slug,
            monthYear: monthYear,
            slug: slug,
            unsecuredRate: `${unsecuredRate}%`,
            unsecuredRateChange: (Math.random() > 0.5 ? '▼' : '▲') + ` ${(Math.random() * 0.3).toFixed(1)}% vs last month`,
            approvalRate: `${approvalRate}%`,
            approvalRateChange: (Math.random() > 0.5 ? '▼' : '▲') + ` ${(Math.random() * 2).toFixed(1)}% vs last month`,
            assetFinanceVolume: `£${assetVolume}bn`,
            assetFinanceVolumeChange: (Math.random() > 0.5 ? '▼' : '▲') + ` ${(Math.random() * 5).toFixed(1)}% YoY`,
            rates: {
                highStreetSecured: `${(parseFloat(unsecuredRate) - 3.8).toFixed(1)}% - ${(parseFloat(unsecuredRate) - 1.4).toFixed(1)}%`,
                challengerUnsecured: `${(parseFloat(unsecuredRate) - 0.8).toFixed(1)}% - ${(parseFloat(unsecuredRate) + 5.3).toFixed(1)}%`,
                alternativeUnsecured: `${(parseFloat(unsecuredRate) + 3.8).toFixed(1)}% - ${(parseFloat(unsecuredRate) + 15.8).toFixed(1)}%`,
                commercialMortgage: `${(parseFloat(unsecuredRate) - 3.05).toFixed(2)}% - ${(parseFloat(unsecuredRate) - 0.95).toFixed(2)}%`
            },
            commentary: `Market commentary for ${monthYear}. The UK SME lending environment saw an average unsecured rate of ${unsecuredRate}%, representing the general risk appetite of alternative lenders during this period. Asset finance volumes reached £${assetVolume}bn as businesses continued to invest in equipment and machinery. Specialist approval rates hovered around ${approvalRate}%, reflecting ${currentDate.getFullYear() < 2023 ? 'strong liquidity in the market' : 'tighter credit conditions and increased lender scrutiny'}.`
        });

        currentDate.setMonth(currentDate.getMonth() - 1);
    }

    const outputPath = path.join(__dirname, '..', 'src', 'data', 'smeFundingData.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Successfully generated ${data.length} months of SME funding data to ${outputPath}`);
}

generateData();
