interface PersonalizationData {
    templateId: string;
    variableName: string;
    customValue: string;
    usageCount: number;
    lastUsed: Date;
}

interface UserPreferences {
    tone: 'formal' | 'casual' | 'passionate';
    length: 'concise' | 'detailed' | 'moderate';
    themes: string[];
    recentCustomizations: PersonalizationData[];
}

export class PersonalizationService {
    /**
     * Save user's custom variable value for future reuse
     * TODO: Implement database storage in template_personalization table
     */
    static async saveCustomization(
        userId: string,
        templateId: string,
        variableName: string,
        customValue: string
    ): Promise<void> {
        console.log('💾 Saving personalization:', { userId, templateId, variableName });
        
        // TODO: Implement upsert logic
        // await db.template_personalization.upsert({
        //     where: {
        //         user_id_template_id_variable_name: {
        //             user_id: userId,
        //             template_id: templateId,
        //             variable_name: variableName
        //         }
        //     },
        //     update: {
        //         custom_value: customValue,
        //         usage_count: { increment: 1 },
        //         last_used: new Date()
        //     },
        //     create: {
        //         user_id: userId,
        //         template_id: templateId,
        //         variable_name: variableName,
        //         custom_value: customValue
        //     }
        // });
        
        // Store in localStorage as fallback for now
        this.saveToLocalStorage(userId, templateId, variableName, customValue);
    }

    /**
     * Get user's previous customizations for smart suggestions
     * TODO: Implement database queries
     */
    static async getUserCustomizations(
        userId: string,
        templateId?: string,
        variableName?: string
    ): Promise<PersonalizationData[]> {
        console.log('📚 Fetching user customizations:', { userId, templateId, variableName });
        
        // TODO: Query template_personalization table
        // const customizations = await db.template_personalization.findMany({
        //     where: {
        //         user_id: userId,
        //         ...(templateId && { template_id: templateId }),
        //         ...(variableName && { variable_name: variableName })
        //     },
        //     orderBy: { last_used: 'desc' }
        // });
        
        // Fallback to localStorage for now
        return this.getFromLocalStorage(userId, templateId, variableName);
    }

    /**
     * Get smart suggestions based on user's past behavior
     * TODO: Implement ML-based recommendation engine
     */
    static async getSmartSuggestions(
        userId: string,
        templateId: string,
        variableName: string
    ): Promise<string[]> {
        console.log('🧠 Generating smart suggestions:', { userId, templateId, variableName });
        
        const customizations = await this.getUserCustomizations(userId, undefined, variableName);
        
        // Extract patterns from past customizations
        const suggestions = customizations
            .map(c => c.customValue)
            .filter(value => value.trim().length > 10) // Only meaningful content
            .slice(0, 3); // Top 3 most recent
        
        return suggestions;
    }

    /**
     * Learn user's writing style from their customizations
     * TODO: Implement ML analysis pipeline
     */
    static async analyzeWritingStyle(userId: string): Promise<UserPreferences> {
        console.log('🔍 Analyzing writing style for user:', userId);
        
        const customizations = await this.getUserCustomizations(userId);
        
        // Mock analysis - replace with actual ML
        const mockPreferences: UserPreferences = {
            tone: this.inferTone(customizations),
            length: this.inferLengthPreference(customizations),
            themes: this.extractThemes(customizations),
            recentCustomizations: customizations.slice(0, 5)
        };
        
        // TODO: Store in user_writing_style table
        // await db.user_writing_style.upsert({
        //     where: { user_id: userId },
        //     update: {
        //         tone_preference: mockPreferences.tone,
        //         length_preference: mockPreferences.length,
        //         personal_themes: mockPreferences.themes,
        //         last_analyzed: new Date()
        //     },
        //     create: {
        //         user_id: userId,
        //         tone_preference: mockPreferences.tone,
        //         length_preference: mockPreferences.length,
        //         personal_themes: mockPreferences.themes
        //     }
        // });
        
        return mockPreferences;
    }

    // Temporary localStorage implementation
    private static saveToLocalStorage(
        userId: string,
        templateId: string,
        variableName: string,
        customValue: string
    ): void {
        if (typeof window === 'undefined') return;
        
        const key = `personalization_${userId}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        
        const existingIndex = existing.findIndex((item: any) => 
            item.templateId === templateId && item.variableName === variableName
        );
        
        const data: PersonalizationData = {
            templateId,
            variableName,
            customValue,
            usageCount: existingIndex >= 0 ? existing[existingIndex].usageCount + 1 : 1,
            lastUsed: new Date()
        };
        
        if (existingIndex >= 0) {
            existing[existingIndex] = data;
        } else {
            existing.push(data);
        }
        
        localStorage.setItem(key, JSON.stringify(existing));
    }

    private static getFromLocalStorage(
        userId: string,
        templateId?: string,
        variableName?: string
    ): PersonalizationData[] {
        if (typeof window === 'undefined') return [];
        
        const key = `personalization_${userId}`;
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        
        return data.filter((item: PersonalizationData) => {
            if (templateId && item.templateId !== templateId) return false;
            if (variableName && item.variableName !== variableName) return false;
            return true;
        });
    }

    // Mock ML analysis functions (to be replaced)
    private static inferTone(customizations: PersonalizationData[]): 'formal' | 'casual' | 'passionate' {
        // TODO: Implement NLP analysis
        return 'casual'; // Mock
    }

    private static inferLengthPreference(customizations: PersonalizationData[]): 'concise' | 'detailed' | 'moderate' {
        // TODO: Analyze average length of customizations
        const avgLength = customizations.reduce((sum, c) => sum + c.customValue.length, 0) / customizations.length;
        
        if (avgLength < 100) return 'concise';
        if (avgLength > 300) return 'detailed';
        return 'moderate';
    }

    private static extractThemes(customizations: PersonalizationData[]): string[] {
        // TODO: Implement topic modeling
        return ['family', 'community', 'education']; // Mock
    }
} 