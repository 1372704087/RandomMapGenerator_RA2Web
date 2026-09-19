// 0x5981f0 ReadRMGMD_INI size=761

int __thiscall sub_5981F0(_DWORD *this)
{
  _BYTE *v2; // eax
  _BYTE *v3; // edi
  int v4; // eax
  int v5; // edx
  int v6; // eax
  int v7; // edx
  int *v8; // eax
  int *v9; // eax
  int *v10; // eax
  int *v11; // eax
  int *v12; // eax
  int *v13; // eax
  int *v14; // eax
  int *v15; // eax
  int *v16; // eax
  int *v17; // eax
  int *v18; // eax
  char *i; // eax
  _DWORD *v20; // esi
  char *j; // eax
  _DWORD *v22; // esi
  int v24[11]; // [esp-1Ch] [ebp-15Ch] BYREF
  int *v25; // [esp+10h] [ebp-130h] BYREF
  int v26; // [esp+14h] [ebp-12Ch] BYREF
  void *Block; // [esp+18h] [ebp-128h]
  char v28; // [esp+21h] [ebp-11Fh]
  _DWORD *v29; // [esp+30h] [ebp-110h]
  _DWORD *v30; // [esp+34h] [ebp-10Ch]
  _DWORD v31[6]; // [esp+38h] [ebp-108h] BYREF
  int v32; // [esp+50h] [ebp-F0h]
  char v33[108]; // [esp+54h] [ebp-ECh] BYREF
  char String[128]; // [esp+C0h] [ebp-80h] BYREF

  sub_4739F0(aRmgmdIni);
  v2 = operator new(0x58u);
  v3 = v2;
  if ( v2 != nullptr )
  {
    sub_535AA0(v2);
    v3[64] = 0;
    *(_DWORD *)v3 = &CCINIClass::`vftable';
  }
  else
  {
    v3 = nullptr;
  }
  sub_526B00(v3);
  sub_4741F0(v33, 0, 0);
  (*(void (__thiscall **)(_DWORD *))(*(this + 98) + 12))(this + 98);
  (*(void (__thiscall **)(_DWORD *))(*(this + 161) + 12))(this + 161);
  (*(void (__thiscall **)(_DWORD *))(*(this + 168) + 12))(this + 168);
  v4 = *(this + 177);
  v30 = this + 177;
  (*(void (**)(void))(v4 + 12))();
  v5 = *(this + 184);
  v29 = this + 184;
  (*(void (**)(void))(v5 + 12))();
  (*(void (__thiscall **)(_DWORD *))(*(this + 105) + 12))(this + 105);
  (*(void (__thiscall **)(_DWORD *))(*(this + 112) + 12))(this + 112);
  v6 = sub_5276D0(off_82B134, aRmgminimumtibe, *(this + 175));
  v7 = *(this + 176);
  *(this + 175) = v6;
  *(this + 176) = sub_5276D0(off_82B134, aRmgmaximumtibe, v7);
  v25 = v24;
  sub_4779E0(this + 98);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aRmglevellights,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v8 = v25;
  *(this + 102) = v25[4];
  *(this + 103) = v8[5];
  *(this + 104) = v8[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 161);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aRmgvegetationm,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v9 = v25;
  *(this + 165) = v25[4];
  *(this + 166) = v9[5];
  *(this + 167) = v9[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 168);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aRmgvegetationm_0,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v10 = v25;
  *(this + 172) = v25[4];
  *(this + 173) = v10[5];
  *(this + 174) = v10[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 105);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aTemperateambie,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v11 = v25;
  *(this + 109) = v25[4];
  *(this + 110) = v11[5];
  *(this + 111) = v11[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 112);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aSnowambientlig,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v12 = v25;
  *(this + 116) = v25[4];
  *(this + 117) = v12[5];
  *(this + 118) = v12[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 119);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aTemperateambie_0,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v13 = v25;
  *(this + 123) = v25[4];
  *(this + 124) = v13[5];
  *(this + 125) = v13[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 126);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aTemperateambie_1,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v14 = v25;
  *(this + 130) = v25[4];
  *(this + 131) = v14[5];
  *(this + 132) = v14[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 133);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aTemperateambie_2,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v15 = v25;
  *(this + 137) = v25[4];
  *(this + 138) = v15[5];
  *(this + 139) = v15[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 140);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aSnowambientred,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v16 = v25;
  *(this + 144) = v25[4];
  *(this + 145) = v16[5];
  *(this + 146) = v16[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  v25 = v24;
  sub_4779E0(this + 147);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aSnowambientgre,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v17 = v25;
  *(this + 151) = v25[4];
  *(this + 152) = v17[5];
  *(this + 153) = v17[6];
  v26 = (int)&VectorClass<int>::`vftable';
  if ( Block != nullptr && v28 != 0 )
    operator delete(Block);
  v25 = v24;
  sub_4779E0(this + 154);
  *v25 = (int)&TypeList<int>::`vftable';
  v25 = (int *)sub_475D70(
                 (int)&v26,
                 off_82B134,
                 (int)aSnowambientblu,
                 v24[0],
                 (void *)v24[1],
                 v24[2],
                 v24[3],
                 v24[4],
                 v24[5],
                 v24[6]);
  sub_478720(v25);
  v18 = v25;
  *(this + 158) = v25[4];
  *(this + 159) = v18[5];
  *(this + 160) = v18[6];
  v26 = (int)&VectorClass<int>::`vftable';
  sub_477D20(&v26);
  *(this + 191) = sub_5276D0(off_82B134, aMaxtrees, *(this + 191));
  if ( sub_528A10(off_82B134, (int)aTemperateorepa, &byte_889F64, String, 0x80u) != 0 )
  {
    sub_5AC400(&v26);
    for ( i = strtok(String, Delimiter); i != nullptr; i = strtok(nullptr, Delimiter) )
    {
      if ( *i == 0 )
        break;
      v25 = (int *)sub_4653C0(i);
      if ( v25 != nullptr )
        sub_5AD7D0(&v25);
    }
    sub_5AD660(&v26);
    v26 = (int)&VectorClass<BuildingTypeClass const *>::`vftable';
    sub_50EA00(&v26);
    v20 = v30;
  }
  else
  {
    v20 = v30;
    sub_5AD660(v30);
  }
  sub_5AC430(v31);
  v20[6] = v32;
  v31[0] = &VectorClass<BuildingTypeClass const *>::`vftable';
  sub_50EA00(v31);
  if ( sub_528A10(off_82B134, (int)aSnoworepatchla, &byte_889F64, String, 0x80u) != 0 )
  {
    sub_5AC400(&v26);
    for ( j = strtok(String, Delimiter); j != nullptr; j = strtok(nullptr, Delimiter) )
    {
      if ( *j == 0 )
        break;
      v25 = (int *)sub_4653C0(j);
      if ( v25 != nullptr )
        sub_5AD7D0(&v25);
    }
    sub_5AD660(&v26);
    v26 = (int)&VectorClass<BuildingTypeClass const *>::`vftable';
    sub_50EA00(&v26);
    v22 = v29;
  }
  else
  {
    v22 = v29;
    sub_5AD660(v29);
  }
  sub_5AC430(v31);
  v31[0] = &VectorClass<BuildingTypeClass const *>::`vftable';
  v22[6] = v32;
  sub_50EA00(v31);
  if ( v3 != nullptr )
    (**(void (__thiscall ***)(void *, int))v3)(v3, 1);
  sub_473CE0(v33);
  return sub_535A70(v33);
}
