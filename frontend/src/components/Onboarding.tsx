import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { RadioGroup, RadioGroupItem } from './UI/radio-group';
import { Slider } from './UI/slider';
import { Progress } from './UI/progress';

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    experience: '',
    goal: '',
    riskTolerance: [50],
    tradingStyle: ''
  });

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progressPercentage = (currentStep / 4) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">プロフィール設定</h2>
            <p className="text-gray-600">基本情報を教えてください</p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">お名前</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="h-12"
                  placeholder="山田太郎"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">トレード経験</h2>
            <p className="text-gray-600">あなたのトレード経験を教えてください</p>
            <RadioGroup 
              value={formData.experience} 
              onValueChange={(value) => setFormData({...formData, experience: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="beginner" id="beginner" />
                <Label htmlFor="beginner">初心者（1年未満）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="intermediate" id="intermediate" />
                <Label htmlFor="intermediate">中級者（1-3年）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="advanced" id="advanced" />
                <Label htmlFor="advanced">上級者（3年以上）</Label>
              </div>
            </RadioGroup>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">投資目標</h2>
            <p className="text-gray-600">どのような目標をお持ちですか？</p>
            <RadioGroup 
              value={formData.goal} 
              onValueChange={(value) => setFormData({...formData, goal: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aggressive" id="aggressive" />
                <Label htmlFor="aggressive">年+20% (積極的成長)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="moderate" />
                <Label htmlFor="moderate">月+5% (安定成長)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stable" id="stable" />
                <Label htmlFor="stable">安定収支 (リスク回避)</Label>
              </div>
            </RadioGroup>
            
            <div className="space-y-4">
              <Label>リスク許容度</Label>
              <div className="px-4">
                <Slider
                  value={formData.riskTolerance}
                  onValueChange={(value) => setFormData({...formData, riskTolerance: value})}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>保守的</span>
                  <span>積極的</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">トレードスタイル</h2>
            <p className="text-gray-600">どのようなスタイルでトレードしますか？</p>
            <RadioGroup 
              value={formData.tradingStyle} 
              onValueChange={(value) => setFormData({...formData, tradingStyle: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="day" id="day" />
                <Label htmlFor="day">デイトレード（当日決済）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="swing" id="swing" />
                <Label htmlFor="swing">スイングトレード（数日〜数週間）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mixed" id="mixed" />
                <Label htmlFor="mixed">両方使い分け</Label>
              </div>
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-[960px] mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">セットアップ進行中</span>
            <span className="text-sm text-gray-600">Step {currentStep} / 4</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Content Container */}
        <div className="bg-white rounded-xl shadow-sm p-10 w-[640px] mx-auto">
          {renderStep()}
          
          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            {currentStep > 1 ? (
              <Button variant="ghost" onClick={handleBack}>
                戻る
              </Button>
            ) : (
              <div />
            )}
            
            <Button 
              onClick={handleNext}
              className="h-12 px-8"
              style={{ backgroundColor: '#5ED0E8' }}
            >
              {currentStep === 4 ? '完了' : '次へ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}