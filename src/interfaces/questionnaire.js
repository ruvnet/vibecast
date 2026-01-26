/**
 * Visa Eligibility Questionnaire
 * Collects user information for optimal program matching
 */

const readline = require('readline');

const QUESTIONS = [
  {
    id: 'age',
    question: 'What is your age?',
    type: 'number',
    validate: (v) => v >= 18 && v <= 65
  },
  {
    id: 'nationality',
    question: 'What is your nationality/citizenship?',
    type: 'text'
  },
  {
    id: 'education',
    question: 'Highest level of education completed?',
    type: 'choice',
    options: [
      { value: 'high_school', label: 'High School' },
      { value: 'diploma', label: 'Diploma/Certificate (1-2 years)' },
      { value: 'bachelors', label: 'Bachelor\'s Degree' },
      { value: 'masters', label: 'Master\'s Degree' },
      { value: 'phd', label: 'PhD/Doctorate' }
    ]
  },
  {
    id: 'workExperience',
    question: 'Years of skilled work experience?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 50
  },
  {
    id: 'canadianExperience',
    question: 'Years of work experience IN CANADA?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 50
  },
  {
    id: 'englishCLB',
    question: 'English language CLB level (4-12, or 0 if not tested)?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 12
  },
  {
    id: 'frenchCLB',
    question: 'French language CLB level (4-12, or 0 if not tested)?',
    type: 'number',
    validate: (v) => v >= 0 && v <= 12
  },
  {
    id: 'jobOffer',
    question: 'Do you have a valid job offer from a Canadian employer?',
    type: 'boolean'
  },
  {
    id: 'provincePreference',
    question: 'Preferred province to settle in?',
    type: 'choice',
    options: [
      { value: 'any', label: 'No preference' },
      { value: 'ON', label: 'Ontario' },
      { value: 'BC', label: 'British Columbia' },
      { value: 'AB', label: 'Alberta' },
      { value: 'QC', label: 'Quebec' },
      { value: 'MB', label: 'Manitoba' },
      { value: 'SK', label: 'Saskatchewan' },
      { value: 'NS', label: 'Nova Scotia' },
      { value: 'NB', label: 'New Brunswick' },
      { value: 'other', label: 'Other province/territory' }
    ]
  },
  {
    id: 'pathwayType',
    question: 'What type of pathway are you looking for?',
    type: 'choice',
    options: [
      { value: 'permanent', label: 'Permanent Residence (PR)' },
      { value: 'work', label: 'Work Permit' },
      { value: 'study', label: 'Study Permit' },
      { value: 'visit', label: 'Visitor Visa' }
    ]
  }
];

class Questionnaire {
  constructor() {
    this.responses = {};
    this.rl = null;
  }

  async run() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n========================================');
    console.log(' Canadian Visa Eligibility Questionnaire');
    console.log('========================================\n');
    console.log('Answer the following questions to find the best visa pathway for you.\n');

    for (const q of QUESTIONS) {
      this.responses[q.id] = await this.askQuestion(q);
    }

    this.rl.close();
    return this.responses;
  }

  askQuestion(q) {
    return new Promise((resolve) => {
      let prompt = q.question;

      if (q.type === 'choice') {
        prompt += '\n';
        q.options.forEach((opt, i) => {
          prompt += `  ${i + 1}. ${opt.label}\n`;
        });
        prompt += 'Enter number: ';
      } else if (q.type === 'boolean') {
        prompt += ' (yes/no): ';
      } else {
        prompt += ': ';
      }

      this.rl.question(prompt, (answer) => {
        let value;

        if (q.type === 'number') {
          value = parseInt(answer, 10);
          if (isNaN(value) || (q.validate && !q.validate(value))) {
            console.log('Invalid input. Please try again.');
            resolve(this.askQuestion(q));
            return;
          }
        } else if (q.type === 'boolean') {
          value = answer.toLowerCase().startsWith('y');
        } else if (q.type === 'choice') {
          const idx = parseInt(answer, 10) - 1;
          if (idx >= 0 && idx < q.options.length) {
            value = q.options[idx].value;
          } else {
            console.log('Invalid selection. Please try again.');
            resolve(this.askQuestion(q));
            return;
          }
        } else {
          value = answer.trim();
        }

        resolve(value);
      });
    });
  }
}

module.exports = { Questionnaire, QUESTIONS };
