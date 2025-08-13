const { GoogleGenerativeAI } = require('@google/generative-ai');


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function AiScanContract(fileBuffer, mimeType) {
    console.log("🤖 Gemini Flash: Extracting contract fingerprint...");
    const prompt = `Analyze the attached rental agreement. Extract the following details and return them as a single-line, pipe-separated string. Do NOT add any explanation, conversational text, or markdown formatting. The required format is exactly: Landlord: [Full Name] | Tenant: [Full Name] | Unit: [Unit Number and Full Address] | From: [Start Date DD/MM/YYYY] | To: [End Date DD/MM/YYYY] | Rent: [Monthly Rent as a number]`;

    try {
        const imagePart = { inlineData: { data: fileBuffer.toString("base64"), mimeType } };
        const result = await flashModel.generateContent([prompt, imagePart]);
        const fingerprint = result.response.text().trim();
        console.log("✅ Fingerprint extracted by Gemini:", fingerprint);
        return fingerprint;
    } catch (error) {
        console.error("❌ Error with Gemini fingerprint extraction:", error);
        throw new Error("AI fingerprint analysis failed.");
    }
}

async function AiCheckDocumentAuthenticity(fileBuffer, mimeType) {
    console.log("🤖 Gemini Pro: Checking for document tampering...");
    const prompt = `Act as a forensic document analyst. Analyze the attached image for signs of digital manipulation, photoshopping, or being a photo of a screen (e.g., moiré patterns, screen glare). Look for inconsistent lighting, pixelation, and unnatural text. Provide a confidence score as a percentage of how authentic the document appears. Respond with ONLY the number. For example: 98.5`;
    
    try {
        const imagePart = { inlineData: { data: fileBuffer.toString("base64"), mimeType } };
        const result = await proModel.generateContent([prompt, imagePart]);
        const score = parseFloat(result.response.text().trim());
        console.log(`📄 Gemini Authenticity Score: ${score}%`);
        return isNaN(score) ? 0 : score;
    } catch (error) {
        console.error("❌ Error with Gemini authenticity check:", error);
        throw new Error("AI authenticity analysis failed.");
    }
}


async function AiExtractDeedData(fileBuffer, mimeType) {
    console.log("🤖 Gemini Flash: Extracting deed data...");
    const prompt = `Analyze the attached Thai property title deed (Chanote). Extract the full name of the current owner and the full property address. Respond with ONLY a valid JSON object with keys "ownerName" and "propertyAddress". For example: {"ownerName": "สมชาย ใจดี", "propertyAddress": "123 Sukhumvit Road, Khlong Toei, Bangkok 10110"}`;

    try {
        const imagePart = { inlineData: { data: fileBuffer.toString("base64"), mimeType } };
        const result = await flashModel.generateContent([prompt, imagePart]);
        const jsonString = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(jsonString);
        console.log(`📄 Gemini extracted deed data:`, extractedData);
        return extractedData;
    } catch (error) {
        console.error("❌ Error with Gemini deed data extraction:", error);
        throw new Error("AI deed analysis failed.");
    }
}


async function AiCompareAddresses(address1, address2) {
    console.log("🤖 Gemini Flash: Comparing addresses...");
    const prompt = `You are an address validation expert for Thailand. Address A is: "${address1}". Address B is: "${address2}". Do these two addresses refer to the same physical property, even with minor typos or formatting differences? Respond with only the word "true" or "false".`;

    try {
        const result = await flashModel.generateContent(prompt);
        const comparison = result.response.text().trim().toLowerCase();
        console.log(`📄 Gemini Address Comparison Result: ${comparison}`);
        return comparison === 'true';
    } catch (error) {
        console.error("❌ Error during Gemini address comparison:", error);
        return false;
    }
}

async function AiFindBestUnitMatch(unitInfoFromDoc, officialUnits) {
    console.log(`🤖 Gemini Flash: Finding best unit match for: "${unitInfoFromDoc}"`);

    // Create a simplified list for the AI prompt
    const unitListForPrompt = officialUnits.map(u => ({
        unitId: u._id.toString(),
        unitNumber: u.unitNumber,
        address: `${u.address.streetAddress}, ${u.address.district}, ${u.address.province}`
    }));

    const prompt = `
        You are an expert at matching property units in Thailand.
        I have a text snippet describing a property unit, extracted from a rental contract: "${unitInfoFromDoc}"
        
        Here is a JSON array of the landlord's official properties from their portfolio:
        ${JSON.stringify(unitListForPrompt)}
        
        Your task is to identify which single property from the JSON array is the most likely match for the text snippet. Consider the unit number (e.g., '279/19'), the building name (e.g., 'UNIO' or 'Ideo Mobi'), and other address details.
        
        Respond with ONLY the 'unitId' string of the single best match.
        If you are not confident in any match, respond with the word "none".
    `;

    try {
        const result = await flashModel.generateContent(prompt);
        let bestMatchId = result.response.text().trim();
        
        // Validate that the AI returned a valid ID from the list
        const isValidId = officialUnits.some(u => u._id.toString() === bestMatchId);
        
        if (bestMatchId.toLowerCase() === 'none' || !isValidId) {
            console.log("📄 AI could not find a confident match.");
            return null;
        }

        console.log(`📄 AI found best match (unitId): "${bestMatchId}"`);
        return bestMatchId; // Return the ID of the matched unit

    } catch (error) {
        console.error("❌ Error during Gemini unit matching:", error);
        return null; // Default to no match on error
    }
}

async function AiextractUtilityBillData(fileBuffer, mimeType) {
    console.log("🤖 Gemini Flash: Extracting utility bill data...");
    const prompt = `
        Analyze the attached utility bill (e.g., electricity, water, internet bill).
        Extract the full name and the full service address listed on the bill.
        Respond with ONLY a valid JSON object with keys "nameOnBill" and "addressOnBill".
    `;
    try {
        const imagePart = { inlineData: { data: fileBuffer.toString("base64"), mimeType } };
        const result = await flashModel.generateContent([prompt, imagePart]);
        const jsonString = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(jsonString);
        console.log(`📄 Gemini extracted utility bill data:`, extractedData);
        return extractedData;
    } catch (error) {
        console.error("❌ Error with Gemini utility bill extraction:", error);
        throw new Error("AI utility bill analysis failed.");
    }
}

module.exports = { 
    AiScanContract,
    AiCheckDocumentAuthenticity,
    AiExtractDeedData,
    AiCompareAddresses,
    AiFindBestUnitMatch,
    AiextractUtilityBillData
};