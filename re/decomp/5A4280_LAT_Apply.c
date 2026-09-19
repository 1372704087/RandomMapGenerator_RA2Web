// 0x5a4280 LAT_Apply size=35D

int __thiscall sub_5A4280(int *this)
{
  int *v1; // edi
  int i; // eax
  int v3; // esi
  double *v4; // ebp
  int v5; // eax
  int j; // eax
  int result; // eax
  int v8; // ebp
  unsigned int v9; // edi
  unsigned int v10; // esi
  int v11; // eax
  _DWORD *v12; // eax
  int v13; // eax
  int v14; // eax
  bool v15; // cc
  int v16; // [esp-Ch] [ebp-5Ch]
  double v17; // [esp-8h] [ebp-58h]
  int v19; // [esp+18h] [ebp-38h]
  int v20; // [esp+20h] [ebp-30h] BYREF
  int v21; // [esp+24h] [ebp-2Ch]
  int v22; // [esp+28h] [ebp-28h] BYREF
  double v23; // [esp+30h] [ebp-20h]
  double v24; // [esp+38h] [ebp-18h]
  __int64 v25; // [esp+40h] [ebp-10h]
  __int64 v26; // [esp+48h] [ebp-8h]

  v1 = this;
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    v21 = *(_DWORD *)(i + 36);
    *((_DWORD *)dword_ABED10 + 20 * (__int16)v21 + 20 * dword_89C2DC * SHIWORD(v21) + 15) = 0;
  }
  sub_578350(&stru_87F7E8);
  v3 = sub_578290(&stru_87F7E8);
  if ( v3 != 0 )
  {
    do
    {
      v21 = *(_DWORD *)(v3 + 36);
      v4 = (double *)((char *)dword_ABED10 + 80 * (__int16)v21 + 80 * dword_89C2DC * SHIWORD(v21));
      if ( sub_486380((_DWORD *)v3) && *(_BYTE *)(v3 + 284) == 0 && *((_BYTE *)v4 + 69) == 0 )
      {
        v21 = *(_DWORD *)(v3 + 36);
        *(_QWORD *)&v24 = (unsigned int)sub_65C780(&unk_ABE890);
        if ( (double)*(__int64 *)&v24 * 2.328306437080797e-10 < v4[5] )
        {
          do
          {
            do
              v23 = sub_5980C0((double *)&byte_ABDFB8) * 15.0 + 20.0;
            while ( v23 < 4.0 );
          }
          while ( v23 > 60.0 );
          v5 = sub_7C5F00(v23);
          sub_5A4B60(v3, dword_ABC2B8, v5, (__int16)v21 + (SHIWORD(v21) << 9), 0);
        }
      }
      v3 = sub_578290(&stru_87F7E8);
    }
    while ( v3 != 0 );
    v1 = this;
  }
  sub_578350(&stru_87F7E8);
  for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
    sub_47CA80(j);
  result = sub_7C5F00(((double)v1[25] * 0.1 + 0.7) * ((double)v1[23] * 0.01) * (double)v1[191]);
  v21 = result;
  v19 = 0;
  if ( result > 0 )
  {
    do
    {
      if ( v19 >= 100 )
        break;
      v8 = 0;
      do
      {
        v9 = dword_89C2DC * dword_89C2DC - 1;
        do
        {
          v25 = v9 + 1;
          v24 = (double)v25;
          do
          {
            v26 = (unsigned int)sub_65C780(&unk_ABE890);
            v10 = sub_7C5F00((double)v26 * v24 * 2.328306437080797e-10);
          }
          while ( v10 > v9 );
          v11 = sub_42D470(0, 0);
        }
        while ( (unsigned __int8)sub_50E470(v11) != 0 );
        ++v8;
        v20 = *((_DWORD *)dword_ABED10 + 20 * v10);
        if ( v8 > 200 )
        {
          v13 = 0;
          goto LABEL_27;
        }
        v12 = (_DWORD *)sub_5657A0(&v20);
      }
      while ( !sub_486380(v12) );
      v13 = v20;
LABEL_27:
      v22 = v13;
      do
      {
        do
          v23 = sub_5980C0((double *)&byte_ABDFB8) * 0.1 + 0.2;
        while ( v23 < 0.05 );
      }
      while ( v23 > 0.4 );
      do
      {
        do
          v24 = sub_5980C0((double *)&byte_ABDFB8) * 10.0 + 25.0;
        while ( v24 < 10.0 );
      }
      while ( v24 > 35.0 );
      v17 = v23;
      v16 = sub_7C5F00(v24);
      v14 = sub_5657A0(&v22);
      result = sub_5A45E0(v14, v16, v17);
      v15 = v21 - result <= 0;
      v21 -= result;
      ++v19;
    }
    while ( !v15 );
  }
  return result;
}
